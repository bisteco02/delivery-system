// Gerenciador WhatsApp com Baileys - Implementação robusta
const makeWASocket = require('@whiskeysockets/baileys').default;
const { makeCacheableSignalKeyStore, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

class WhatsAppManager {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.authDir = path.join(__dirname, 'whatsapp-auth');
    this.messageQueue = [];
    this.isProcessingQueue = false;

    // Criar diretório de autenticação se não existir
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
    }
  }

  async initialize() {
    try {
      console.log('[WhatsApp] Inicializando Baileys...');
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

      this.socket = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys)
        },
        printQRInTerminal: true,
        browser: ['Ubuntu', 'Chrome', '130.0.6723.58']
      });

      // Event: Credentials updated
      this.socket.ev.on('creds.update', saveCreds);

      // Event: Connection update
      this.socket.ev.on('connection.update', (update) => {
        this.handleConnectionUpdate(update);
      });

      // Event: Messages upsert
      this.socket.ev.on('messages.upsert', (m) => {
        this.handleMessagesUpsert(m);
      });

      console.log('[WhatsApp] ✅ Baileys inicializado com sucesso');
      return true;
    } catch (error) {
      console.error('[WhatsApp] Erro ao inicializar Baileys:', error.message);
      console.error('[WhatsApp] Stack:', error.stack);
      return false;
    }
  }

  handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr } = update;

    // QR Code
    if (qr) {
      console.log('[WhatsApp] QR Code gerado - escaneie no seu telefone');
    }

    // Connection states
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;

      if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.isConnected = false;
        this.reconnectAttempts++;
        console.log(
          `[WhatsApp] Conexão perdida. Tentando reconectar... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
        );

        setTimeout(() => {
          this.initialize();
        }, this.reconnectDelay * this.reconnectAttempts);
      } else if (!shouldReconnect) {
        console.log('[WhatsApp] Sessão expirada. Deletando arquivo de autenticação...');
        this.deleteAuthFiles();
      } else {
        console.log('[WhatsApp] Máximo de tentativas de reconexão atingido');
      }
    }

    if (connection === 'open') {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('[WhatsApp] ✅ Conectado com sucesso!');
      this.processMessageQueue();
    }

    if (connection === 'connecting') {
      console.log('[WhatsApp] Conectando...');
    }
  }

  handleMessagesUpsert(m) {
    // Apenas log de mensagens recebidas
    if (m.type === 'notify') {
      console.log('[WhatsApp] Mensagens recebidas:', m.messages.length);
    }
  }

  async sendMessage(phoneNumber, message) {
    return new Promise((resolve) => {
      // Adicionar à fila
      this.messageQueue.push({ phoneNumber, message, resolve });
      this.processMessageQueue();
    });
  }

  async processMessageQueue() {
    if (this.isProcessingQueue || this.messageQueue.length === 0 || !this.isConnected) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.messageQueue.length > 0 && this.isConnected) {
      const { phoneNumber, message, resolve } = this.messageQueue.shift();

      try {
        const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;

        console.log(`[WhatsApp] Enviando mensagem para ${phoneNumber}...`);

        const response = await this.socket.sendMessage(jid, { text: message });

        console.log(`[WhatsApp] ✅ Mensagem enviada para ${phoneNumber}`);
        resolve({ success: true, messageId: response.key.id });
      } catch (error) {
        console.error(`[WhatsApp] ❌ Erro ao enviar para ${phoneNumber}:`, error.message);
        resolve({ success: false, error: error.message });
      }

      // Pequeno delay entre mensagens
      await new Promise((r) => setTimeout(r, 1000));
    }

    this.isProcessingQueue = false;
  }

  async getPhoneNumbers() {
    if (!this.isConnected || !this.socket) {
      return [];
    }

    try {
      const jids = Object.keys(this.socket.store.contacts || {});
      return jids.filter((jid) => jid.endsWith('@s.whatsapp.net'));
    } catch (error) {
      console.error('[WhatsApp] Erro ao obter números:', error.message);
      return [];
    }
  }

  deleteAuthFiles() {
    try {
      const authFile = path.join(this.authDir, 'auth.json');
      if (fs.existsSync(authFile)) {
        fs.unlinkSync(authFile);
        console.log('[WhatsApp] Arquivo de autenticação deletado');
      }
    } catch (error) {
      console.error('[WhatsApp] Erro ao deletar arquivo de auth:', error.message);
    }
  }

  isReady() {
    return this.isConnected && this.socket !== null;
  }

  async disconnect() {
    if (this.socket) {
      await this.socket.end();
      this.isConnected = false;
      console.log('[WhatsApp] Desconectado');
    }
  }
}

module.exports = new WhatsAppManager();
