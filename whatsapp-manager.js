// Gerenciador WhatsApp com Baileys - Implementação robusta
const makeWASocket = require('@whiskeysockets/baileys').default;
const { makeCacheableSignalKeyStore, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
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
    this.lastQRData = null; // Armazenar último QR code
    this.phoneNumber = null; // Armazenar número conectado

    // Criar diretório de autenticação se não existir
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
    }
  }

  async initialize() {
    try {
      console.log('[WhatsApp] Inicializando Baileys...');
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

      const { version } = await fetchLatestBaileysVersion();

      this.socket = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys)
        },
        printQRInTerminal: false,
        browser: ['Padoca', 'Chrome', '1.0.0']
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
    const { connection, lastDisconnect, qr, isNewLogin } = update;

    // QR Code
    if (qr) {
      this.lastQRData = qr; // Armazenar QR data
      console.log('[WhatsApp] QR Code gerado - escaneie no seu telefone');
      
      // Limpar timer anterior se existir
      if (this.qrExpiryTimer) clearTimeout(this.qrExpiryTimer);
      
      // QR expira em 10 minutos - maior tempo para escanear
      this.qrExpiryTimer = setTimeout(() => {
        if (!this.isConnected && this.socket) {
          console.log('[WhatsApp] QR expirou após 10 minutos, solicitando novo QR...');
          // Força reconexão para gerar novo QR
          this.socket.ws?.close();
        }
      }, 600000); // 10 minutos
    }

    // Connection states
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;

      if (shouldReconnect) {
        this.isConnected = false;
        console.log('[WhatsApp] Conexão perdida. Regenerando QR...');
        
        // Não incrementar tentativas infinitamente, deixar regenerar
        if (this.reconnectAttempts < 1) {
          this.reconnectAttempts++;
        }
        
        // Reiniciar pra gerar novo QR
        setTimeout(() => {
          if (!this.isConnected) {
            this.reconnectAttempts = 0;
            this.initialize();
          }
        }, 3000);
      } else if (!shouldReconnect) {
        console.log('[WhatsApp] Sessão expirada. Deletando arquivo de autenticação...');
        this.deleteAuthFiles();
      }
    }

    if (connection === 'open') {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.lastQRData = null; // Limpar QR quando conectado
      
      // Tentar obter número do usuário
      if (this.socket && this.socket.user) {
        this.phoneNumber = this.socket.user.id.replace('@s.whatsapp.net', '');
        console.log(`[WhatsApp] ✅ Conectado com sucesso! Número: ${this.phoneNumber}`);
      } else {
        console.log('[WhatsApp] ✅ Conectado com sucesso!');
      }
      
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
      if (fs.existsSync(this.authDir)) {
        fs.rmSync(this.authDir, { recursive: true, force: true });
        fs.mkdirSync(this.authDir, { recursive: true });
        console.log('[WhatsApp] Arquivos de autenticação removidos');
      }
    } catch (error) {
      console.error('[WhatsApp] Erro ao deletar arquivo de auth:', error.message);
    }
  }

  async resetAuth() {
    try {
      await this.disconnect();
      this.deleteAuthFiles();
      this.lastQRData = null;
      this.phoneNumber = null;
      this.isConnected = false;
      return await this.initialize();
    } catch (error) {
      console.error('[WhatsApp] Erro ao resetar auth:', error.message);
      return false;
    }
  }

  isReady() {
    return this.isConnected && this.socket !== null;
  }

  async disconnect() {
    if (this.socket) {
      await this.socket.end();
      this.isConnected = false;
      this.lastQRData = null;
      if (this.qrExpiryTimer) clearTimeout(this.qrExpiryTimer);
      console.log('[WhatsApp] Desconectado');
    }
  }
}

module.exports = new WhatsAppManager();
