// Servidor da Padoca - Backend completo
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const fsSync = require('fs');
const https = require('https');
const path = require('path');
const multer = require('multer');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcryptjs');
const selfsigned = require('selfsigned');
const { MercadoPagoConfig, PreApprovalPlan, PreApproval, Payment } = require('mercadopago');

// WhatsApp Manager com Baileys
const whatsappManager = require('./whatsapp-manager');

// Serviço de Impressão Integrado
const PrintService = require('./integrated-print-service');
let printService = null;
const ENABLE_SERVER_PRINT_SERVICE = process.env.ENABLE_SERVER_PRINT_SERVICE === 'true';

const app = express();
const PORT = process.env.PORT || 3001;

const DOMAIN = process.env.DOMAIN || 'padocadodede.com';
const HTTPS_CERT_DIR = `/etc/letsencrypt/live/${DOMAIN}`;
// Em VPS com Nginx, o HTTPS deve ficar no proxy reverso (porta 443),
// evitando conflito com o Node na mesma porta.
const HTTPS_ENABLED = process.env.ENABLE_INTERNAL_HTTPS === 'true' && fsSync.existsSync(HTTPS_CERT_DIR);

app.use(session({
  secret: process.env.SESSION_SECRET || 'padoca-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  store: new SQLiteStore(),
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

if (HTTPS_ENABLED) {
  app.use((req, res, next) => {
    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    if (!isSecure) {
      return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    }
    next();
  });
}

// Upload de imagens
const uploadsDir = path.join(__dirname, 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${timestamp}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas'));
    }
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Admin
const ADMIN_USUARIO = process.env.ADMIN_USER || 'admin';
const ADMIN_SENHA_HASH = bcrypt.hashSync(process.env.ADMIN_PASS || 'admin123', 10);
const ADMIN_DOMAIN = process.env.ADMIN_DOMAIN || '';
const ADMIN_BYPASS_TOKEN = process.env.ADMIN_TOKEN || '';

app.use((req, res, next) => {
  const adminPaths = ['/painel-admin.html', '/painel-admin.js', '/painel-admin.css', '/painel-admin'];
  const isAdminRequest = adminPaths.some(p => req.path === p || req.path.startsWith(p + '/'));
  if (!isAdminRequest) return next();

  const host = (req.headers.host || '').split(':')[0];
  if (ADMIN_DOMAIN && host === ADMIN_DOMAIN) return next();
  if (req.session.adminLoggedIn) return next();

  const token = req.headers['x-admin-token'] || req.query.admin_token;
  if (ADMIN_BYPASS_TOKEN && token === ADMIN_BYPASS_TOKEN) return next();

  if (req.path === '/painel-admin.html') {
    return res.redirect('/login');
  }
  return res.status(403).send('Acesso restrito. Faça login em /login.');
});

// ==================== ATALHOS DE ACESSO RÁPIDO ====================

app.get('/painel', (req, res) => {
  if (!req.session.adminLoggedIn) return res.redirect('/login');
  res.redirect('/painel-admin.html');
});

// ==================== ARQUIVOS ESTÁTICOS ====================

app.use(express.static('.'));
app.use('/uploads', express.static(uploadsDir));

app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Login e autenticação
app.get('/login', (req, res) => {
  if (req.session.adminLoggedIn) return res.redirect('/painel-admin.html');
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Login - Painel Admin Padoca</title>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Poppins', sans-serif; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex; 
          justify-content: center; 
          align-items: center; 
          height: 100vh;
          min-height: 100vh;
        }
        .login-container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          width: 100%;
          max-width: 400px;
          padding: 50px 40px;
          animation: slideUp 0.5s ease-out;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .logo-section {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 50px;
          margin-bottom: 15px;
          display: block;
        }
        h1 {
          color: #333;
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .subtitle {
          color: #666;
          font-size: 14px;
          font-weight: 400;
        }
        .form-group {
          margin-bottom: 20px;
        }
        label {
          display: block;
          color: #333;
          font-weight: 500;
          margin-bottom: 8px;
          font-size: 14px;
        }
        input {
          width: 100%;
          padding: 12px 15px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-family: 'Poppins', sans-serif;
          font-size: 14px;
          transition: all 0.3s ease;
        }
        input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        input::placeholder {
          color: #999;
        }
        .remember-forgot {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          font-size: 13px;
        }
        .remember-forgot a {
          color: #667eea;
          text-decoration: none;
          transition: color 0.3s;
        }
        .remember-forgot a:hover {
          color: #764ba2;
        }
        button {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-family: 'Poppins', sans-serif;
        }
        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
        }
        button:active {
          transform: translateY(0);
        }
        .info-box {
          background: #f0f4ff;
          border-left: 4px solid #667eea;
          padding: 12px 15px;
          border-radius: 6px;
          margin-top: 20px;
          font-size: 12px;
          color: #555;
        }
        .info-box strong {
          color: #333;
        }
      </style>
    </head>
    <body>
      <div class="login-container">
        <div class="logo-section">
          <span class="logo">🍞</span>
          <h1>Padoca Delivery</h1>
          <p class="subtitle">Painel Administrativo</p>
        </div>
        
        <form action="/login" method="POST">
          <div class="form-group">
            <label for="usuario"><i class="fas fa-user" style="margin-right: 8px;"></i>Usuário</label>
            <input type="text" id="usuario" name="usuario" placeholder="Digite seu usuário" required autofocus>
          </div>
          
          <div class="form-group">
            <label for="senha"><i class="fas fa-lock" style="margin-right: 8px;"></i>Senha</label>
            <input type="password" id="senha" name="senha" placeholder="Digite sua senha" required>
          </div>
          
          <div class="remember-forgot">
            <label style="margin: 0;">
              <input type="checkbox" style="width: auto; margin-right: 5px;"> Lembrar-me
            </label>
          </div>
          
          <button type="submit">
            <i class="fas fa-sign-in-alt" style="margin-right: 8px;"></i>Acessar Painel
          </button>
        </form>
        
        <div class="info-box">
          <strong>💡 Aviso:</strong> Configure as credenciais de acesso no arquivo <code>.env</code>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.post('/login', (req, res) => {
  const { usuario, senha } = req.body;
  if (usuario === ADMIN_USUARIO && bcrypt.compareSync(senha, ADMIN_SENHA_HASH)) {
    req.session.adminLoggedIn = true;
    return res.redirect('/painel-admin.html');
  }
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Erro de Login - Padoca Delivery</title>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Poppins', sans-serif; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex; 
          justify-content: center; 
          align-items: center; 
          height: 100vh;
          min-height: 100vh;
        }
        .error-container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          width: 100%;
          max-width: 400px;
          padding: 50px 40px;
          text-align: center;
          animation: slideUp 0.5s ease-out;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .error-icon {
          font-size: 60px;
          color: #dc3545;
          margin-bottom: 20px;
          display: block;
        }
        h1 {
          color: #dc3545;
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 10px;
        }
        .error-message {
          color: #666;
          font-size: 14px;
          margin-bottom: 30px;
          line-height: 1.6;
        }
        .button-group {
          display: flex;
          gap: 10px;
        }
        a, button {
          flex: 1;
          padding: 12px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.3s ease;
          border: none;
          cursor: pointer;
          font-family: 'Poppins', sans-serif;
        }
        .btn-retry {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .btn-retry:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
        }
        .hint-box {
          background: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 12px 15px;
          border-radius: 6px;
          margin-top: 20px;
          font-size: 12px;
          color: #856404;
        }
      </style>
    </head>
    <body>
      <div class="error-container">
        <i class="fas fa-exclamation-circle error-icon"></i>
        <h1>Acesso Negado</h1>
        <p class="error-message">
          ❌ Usuário ou senha incorretos.<br>
          Por favor, verifique suas credenciais e tente novamente.
        </p>
        
        <div class="button-group">
          <a href="/login" class="btn-retry">
            <i class="fas fa-arrow-left"></i> Voltar
          </a>
        </div>
        
        <div class="hint-box">
          <strong>💡 Dica:</strong> As credenciais estão configuradas no arquivo <code>.env</code>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Erro ao fazer logout:', err);
    res.redirect('/login');
  });
});

// Middleware de autenticação WhatsApp API
function autenticarWhatsAppAPI(req, res, next) {
  // Removido - não há mais API WhatsApp
  res.status(410).json({ error: 'API WhatsApp removida. Use links wa.me' });
}

// ==================== ARQUIVOS JSON ====================

const PEDIDOS_FILE = path.join(__dirname, '_backup', 'pedidos.json');
const CARDAPIO_FILE = path.join(__dirname, '_backup', 'cardapio.json');
const COMPANY_FILE = path.join(__dirname, '_backup', 'company-data.json');
const PROMOTIONS_FILE = path.join(__dirname, '_backup', 'promotions.json');
const CUSTOM_CATEGORIES_FILE = path.join(__dirname, '_backup', 'custom-categories.json');
const ITEM_PROMOTIONS_FILE = path.join(__dirname, '_backup', 'item-promotions.json');
const ADDONS_FILE = path.join(__dirname, '_backup', 'addons.json');

// Inicializar arquivos
async function inicializarArquivos() {
  try {
    await fs.access(uploadsDir);
  } catch {
    await fs.mkdir(uploadsDir, { recursive: true });
  }

  const arquivos = [
    { path: PEDIDOS_FILE, default: [] },
    { path: CARDAPIO_FILE, default: null },
    { path: COMPANY_FILE, default: {} },
    { path: PROMOTIONS_FILE, default: [] },
    { path: CUSTOM_CATEGORIES_FILE, default: [] },
    { path: ITEM_PROMOTIONS_FILE, default: [] }
    ,{ path: ADDONS_FILE, default: [] }
  ];

  for (const arquivo of arquivos) {
    try {
      await fs.access(arquivo.path);
    } catch {
      await fs.writeFile(arquivo.path, JSON.stringify(arquivo.default, null, 2));
    }
  }
}

// Funções para ler/salvar arquivos
async function lerCardapio() {
  try {
    const data = await fs.readFile(CARDAPIO_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

async function salvarCardapio(cardapio) {
  await fs.writeFile(CARDAPIO_FILE, JSON.stringify(cardapio, null, 2));
}

async function lerPromotions() {
  try {
    const data = await fs.readFile(PROMOTIONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

async function salvarPromotions(promotions) {
  await fs.writeFile(PROMOTIONS_FILE, JSON.stringify(promotions, null, 2));
}

async function lerCompanyData() {
  try {
    const data = await fs.readFile(COMPANY_FILE, 'utf8');
    return JSON.parse(data || '{}');
  } catch (error) {
    return {};
  }
}

async function salvarCompanyData(companyData) {
  await fs.writeFile(COMPANY_FILE, JSON.stringify(companyData || {}, null, 2));
}

async function lerPedidos() {
  try {
    const data = await fs.readFile(PEDIDOS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

async function salvarPedidos(pedidos) {
  await fs.writeFile(PEDIDOS_FILE, JSON.stringify(pedidos, null, 2));
}

async function lerItemPromotions() {
  try {
    const data = await fs.readFile(ITEM_PROMOTIONS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function salvarItemPromotions(promotions) {
  await fs.writeFile(ITEM_PROMOTIONS_FILE, JSON.stringify(promotions, null, 2));
}

// Ler/salvar adicionais
async function lerAddons() {
  try {
    const data = await fs.readFile(ADDONS_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (error) {
    return [];
  }
}

async function salvarAddons(addons) {
  await fs.writeFile(ADDONS_FILE, JSON.stringify(addons || [], null, 2));
}

// Utilidades
const normalizarWhatsapp = (valor = '') => (valor || '').replace(/\D/g, '');

const horarios = {
  0: { nome: 'Domingo', abertura: '18:30', fechamento: '23:00' },
  1: { nome: 'Segunda', abertura: '18:30', fechamento: '23:00' },
  2: { nome: 'Terça', abertura: '18:30', fechamento: '23:00' },
  3: { nome: 'Quarta', abertura: null, fechamento: null, fechado: true },
  4: { nome: 'Quinta', abertura: '18:30', fechamento: '23:00' },
  5: { nome: 'Sexta', abertura: '18:30', fechamento: '23:00' },
  6: { nome: 'Sábado', abertura: '18:30', fechamento: '23:00' }
};

function expedienteFechado(agora = new Date()) {
  const dia = agora.getDay();
  const horarioDia = horarios[dia];
  if (!horarioDia || horarioDia.fechado) return true;

  const [fechHora, fechMin] = horarioDia.fechamento.split(':').map(Number);
  const horaAtual = agora.getHours() + agora.getMinutes() / 60;
  const horaFechamento = fechHora + fechMin / 60;
  return horaAtual > horaFechamento;
}

// API - Login
app.post('/api/login', (req, res) => {
  const { usuario, senha } = req.body;

  if (usuario === ADMIN_USUARIO && senha === ADMIN_SENHA) {
    res.json({
      success: true,
      token: 'token-admin-' + Date.now(),
      message: 'Login realizado com sucesso'
    });
  } else {
    res.json({
      success: false,
      message: 'Usuário ou senha incorretos'
    });
  }
});

// API - Pedidos
app.post('/api/pedidos', async (req, res) => {
  try {
    const { cliente, itens, total, endereco, bairro, taxaEntrega, tipoEntrega, observacoes, pagamento } = req.body;

    if (!cliente || !cliente.whatsapp || !cliente.nome || !itens || itens.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Dados incompletos. Cliente e itens são obrigatórios.' 
      });
    }

    const novoPedido = {
      id: Date.now().toString(),
      cliente: {
        nome: cliente.nome,
        whatsapp: cliente.whatsapp,
        whatsappLimpo: normalizarWhatsapp(cliente.whatsapp)
      },
      itens: itens.map(item => ({
        nome: item.nome || item.name,
        quantidade: item.quantidade || item.quantity,
        precoUnitario: item.precoUnitario || item.basePrice,
        precoTotal: item.precoTotal || item.totalPrice,
        bebida: item.bebida,
        adicionais: item.adicionais,
        observacoes: item.observacoes,
        imagem: item.imagem || item.image
      })),
      total: total,
      endereco: endereco,
      bairro: bairro,
      taxaEntrega: taxaEntrega,
      tipoEntrega: tipoEntrega,
      observacoes: observacoes,
      pagamento: pagamento || { forma: null },
      status: 'pendente',
      data: new Date().toISOString()
    };

    const pedidos = await lerPedidos();
    pedidos.push(novoPedido);
    await salvarPedidos(pedidos);

    console.log('✅ Novo pedido recebido:', novoPedido.id);
    console.log('📱 Cliente WhatsApp:', novoPedido.cliente.whatsappLimpo);

    // Enviar mensagem WhatsApp automaticamente
    if (whatsappManager.isReady()) {
      console.log('[DEBUG] WhatsApp está pronto, tentando enviar...');
      try {
        const clienteWhatsapp = novoPedido.cliente.whatsappLimpo;
        const clienteNome = novoPedido.cliente.nome;
        
        // Formatar mensagem
        const itensStr = novoPedido.itens
          .map(i => `• ${i.quantidade}x ${i.nome}${i.adicionais && i.adicionais.length > 0 ? ' +' : ''}`)
          .join('\n');
        
        const mensagem = `🍕 *Pedido Confirmado!*\n\nOlá ${clienteNome}!\n\nSeu pedido foi recebido com sucesso!\n\n*Itens:*\n${itensStr}\n\n*Total:* R$ ${novoPedido.total.toFixed(2)}\n*Endereço:* ${novoPedido.endereco}\n*Bairro:* ${novoPedido.bairro}\n\nEntraremos em contato em breve!`;
        
        console.log('[DEBUG] Mensagem a ser enviada:', mensagem);
        
        whatsappManager.sendMessage(clienteWhatsapp, mensagem).then(result => {
          if (result.success) {
            console.log(`✅ WhatsApp enviado com sucesso para ${clienteWhatsapp}`);
            console.log(`📬 Message ID: ${result.messageId}`);
          } else {
            console.warn(`⚠️ WhatsApp FALHOU para ${clienteWhatsapp}: ${result.error}`);
          }
        }).catch(err => {
          console.error(`❌ Erro crítico ao enviar WhatsApp: ${err.message}`);
        });
      } catch (error) {
        console.error('❌ Erro ao preparar envio WhatsApp:', error.message);
      }
    } else {
      console.warn('⚠️ WhatsApp NÃO está pronto. Status:', whatsappManager.isConnected ? 'Conectado' : 'Desconectado');
    }

    // Disparar webhook automaticamente para Make.com/Zapier
    try {
      const webhookUrl = process.env.WEBHOOK_URL;
      if (webhookUrl) {
        fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pedidoId: novoPedido.id,
            clienteWhatsapp: novoPedido.cliente.whatsapp,
            clienteNome: novoPedido.cliente.nome,
            itens: novoPedido.itens,
            total: novoPedido.total,
            endereco: novoPedido.endereco,
            timestamp: novoPedido.data
          })
        }).catch(err => console.error('Erro ao chamar webhook:', err));
      }
    } catch (error) {
      console.error('Aviso: webhook não disparou', error.message);
    }

    res.json({ 
      success: true, 
      message: 'Pedido recebido com sucesso!',
      pedido: novoPedido
    });
  } catch (error) {
    console.error('Erro ao processar pedido:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao processar pedido.' 
    });
  }
});

// ==================== WEBHOOK PARA AUTOMAÇÃO ====================
// Rota que o Make.com/Zapier vai usar para disparar notificações automáticas
app.post('/api/webhook/pedido', async (req, res) => {
  try {
    const { pedidoId, clienteWhatsapp, clienteNome, itens, total, endereco } = req.body;

    if (!pedidoId || !clienteWhatsapp) {
      return res.status(400).json({ success: false, message: 'Dados incompletos' });
    }

    // Formatar mensagem para enviar
    const itemsText = Array.isArray(itens) 
      ? itens.map(item => `- ${item.quantidade}x ${item.nome}`).join('\n')
      : '';

    const mensagem = `🍞 *Pedido Recebido!*

✅ Seu pedido foi confirmado!
🆔 *Pedido #${pedidoId}*

📍 Local: ${endereco || 'Para retirar'}
💰 *Total: R$ ${parseFloat(total).toFixed(2)}*

📋 Itens:
${itemsText}

⏱️  Tempo estimado: 30-45 minutos

Obrigado! 🙏`;

    // Retorna a mensagem para o Make.com enviar
    res.json({
      success: true,
      message: 'Webhook acionado',
      whatsappNumber: clienteWhatsapp,
      clienteName: clienteNome,
      orderMessage: mensagem,
      formattedNumber: `55${clienteWhatsapp.replace(/\D/g, '')}`
    });

    console.log(`✅ Webhook acionado para pedido ${pedidoId}`);
  } catch (error) {
    console.error('Erro no webhook:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para testar envio direto de WhatsApp
app.post('/api/test-whatsapp', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'phoneNumber e message são obrigatórios' 
      });
    }

    if (!whatsappManager.isReady()) {
      return res.json({ 
        success: false, 
        error: 'WhatsApp não está conectado',
        connected: whatsappManager.isConnected
      });
    }

    console.log(`[TEST] Enviando para ${phoneNumber}: ${message}`);
    const result = await whatsappManager.sendMessage(phoneNumber, message);
    
    console.log('[TEST] Resultado:', result);
    res.json(result);
  } catch (error) {
    console.error('[TEST] Erro:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/pedidos/:whatsapp', async (req, res) => {
  try {
    const { whatsapp } = req.params;
    const whatsappNormalizado = normalizarWhatsapp(whatsapp);
    const pedidos = await lerPedidos();
    const agora = new Date();

    if (expedienteFechado(agora)) {
      return res.json({ success: true, pedidos: [], fechado: true });
    }

    const dataHoje = agora.toLocaleDateString('pt-BR');
    const pedidosCliente = pedidos
      .filter(p => normalizarWhatsapp(p.cliente.whatsapp || p.cliente.whatsappLimpo) === whatsappNormalizado)
      .filter(p => new Date(p.data).toLocaleDateString('pt-BR') === dataHoje);
    
    res.json({ 
      success: true, 
      pedidos: pedidosCliente 
    });
  } catch (error) {
    console.error('Erro ao buscar pedidos:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar pedidos.' 
    });
  }
});

app.get('/api/pedidos', async (req, res) => {
  try {
    const todosPedidos = await lerPedidos();

    // Retornar todos os pedidos ordenados por data (mais recentes primeiro)
    const pedidosOrdenados = todosPedidos.sort((a, b) => new Date(b.data) - new Date(a.data));

    res.json({
      success: true,
      pedidos: pedidosOrdenados
    });
  } catch (error) {
    console.error('Erro ao buscar pedidos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar pedidos.'
    });
  }
});

app.patch('/api/pedidos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const pedidos = await lerPedidos();
    const index = pedidos.findIndex(p => p.id === id);

    if (index === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'Pedido não encontrado.' 
      });
    }

    pedidos[index].status = status;
    await salvarPedidos(pedidos);

    res.json({ 
      success: true, 
      message: 'Status atualizado com sucesso!',
      pedido: pedidos[index]
    });
  } catch (error) {
    console.error('Erro ao atualizar pedido:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao atualizar pedido.' 
    });
  }
});

// ==================== ROTAS - CARDÁPIO ====================

app.get('/api/cardapio', async (req, res) => {
  try {
    const cardapio = await lerCardapio();
    res.json({ 
      success: true, 
      cardapio: cardapio 
    });
  } catch (error) {
    console.error('Erro ao buscar cardápio:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar cardápio.' 
    });
  }
});

app.post('/api/cardapio', async (req, res) => {
  try {
    const { cardapio } = req.body;
    
    if (!cardapio || !Array.isArray(cardapio)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cardápio inválido.' 
      });
    }

    await salvarCardapio(cardapio);
    
    res.json({ 
      success: true, 
      message: 'Cardápio atualizado com sucesso!'
    });
  } catch (error) {
    console.error('Erro ao salvar cardápio:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao salvar cardápio.' 
    });
  }
});

// ==================== ROTAS - PROMOÇÕES ====================

app.get('/api/promotions', async (req, res) => {
  try {
    const promotions = await lerPromotions();
    res.json({ 
      success: true, 
      promotions: promotions 
    });
  } catch (error) {
    console.error('Erro ao buscar promoções:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar promoções.' 
    });
  }
});

app.post('/api/promotions', async (req, res) => {
  try {
    const { promotions } = req.body;
    
    if (!promotions || !Array.isArray(promotions)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Promoções inválidas.' 
      });
    }

    await salvarPromotions(promotions);
    
    res.json({ 
      success: true, 
      message: 'Promoções atualizadas com sucesso!'
    });
  } catch (error) {
    console.error('Erro ao salvar promoções:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao salvar promoções.' 
    });
  }
});

// ==================== ROTAS - DADOS DA EMPRESA ====================

app.get('/api/company-data', async (req, res) => {
  try {
    const companyData = await lerCompanyData();
    res.json({ success: true, companyData });
  } catch (error) {
    console.error('Erro ao buscar dados da empresa:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar dados da empresa.' });
  }
});

app.post('/api/company-data', async (req, res) => {
  try {
    const { companyData } = req.body;

    if (!companyData || typeof companyData !== 'object') {
      return res.status(400).json({ success: false, message: 'Dados inválidos.' });
    }

    await salvarCompanyData(companyData);

    res.json({ success: true, message: 'Dados da empresa salvos com sucesso!' });
  } catch (error) {
    console.error('Erro ao salvar dados da empresa:', error);
    res.status(500).json({ success: false, message: 'Erro ao salvar dados da empresa.' });
  }
});

// ==================== ROTAS - UPLOAD ====================

app.post('/api/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Nenhuma imagem foi enviada'
      });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    
    res.json({
      success: true,
      message: 'Imagem enviada com sucesso!',
      imageUrl: imageUrl,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Erro ao fazer upload:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao fazer upload da imagem: ' + error.message
    });
  }
});

// ==================== ROTAS - CATEGORIAS ====================

app.get('/api/custom-categories', async (req, res) => {
  try {
    const data = await fs.readFile(CUSTOM_CATEGORIES_FILE, 'utf8');
    const categories = JSON.parse(data);
    res.json({ success: true, categories });
  } catch (error) {
    res.json({ success: true, categories: [] });
  }
});

app.post('/api/custom-categories', async (req, res) => {
  try {
    const { categories } = req.body;
    await fs.writeFile(CUSTOM_CATEGORIES_FILE, JSON.stringify(categories, null, 2));
    res.json({ success: true, message: 'Categorias salvas com sucesso' });
  } catch (error) {
    console.error('Erro ao salvar categorias:', error);
    res.status(500).json({ success: false, message: 'Erro ao salvar categorias' });
  }
});

app.get('/api/categories-merged', async (req, res) => {
  try {
    const categoriasPadrao = {
      burguers: { emoji: '🍔', nome: 'Burguers', icon: 'fa-burger' },
      pizzas: { emoji: '🍕', nome: 'Pizzas', icon: 'fa-pizza-slice' },
      porcoes: { emoji: '🍟', nome: 'Porções', icon: 'fa-drumstick-bite' },
      sobremesas: { emoji: '🍰', nome: 'Doces', icon: 'fa-cake-candles' },
      bebidas: { emoji: '🥤', nome: 'Bebidas', icon: 'fa-wine-glass' }
    };

    const data = await fs.readFile(CUSTOM_CATEGORIES_FILE, 'utf8');
    const customCategories = JSON.parse(data);

    const merged = { ...categoriasPadrao };

    customCategories.forEach(cat => {
      if (merged[cat.key]) {
        merged[cat.key] = { ...merged[cat.key], emoji: cat.emoji || merged[cat.key].emoji, nome: cat.nome };
      } else {
        merged[cat.key] = { emoji: cat.emoji || '📦', nome: cat.nome, icon: 'fa-box' };
      }
    });

    res.json({ success: true, categories: merged });
  } catch (error) {
    console.error('Erro ao mesclar categorias:', error);
    res.status(500).json({ success: false, message: 'Erro ao obter categorias' });
  }
});

    

// ==================== ROTAS - ADDONS (ADICIONAIS) ====================

app.get('/api/addons', async (req, res) => {
  try {
    const addons = await lerAddons();
    res.json({ success: true, addons });
  } catch (error) {
    console.error('Erro ao buscar addons:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar adicionais' });
  }
});

app.post('/api/addons', async (req, res) => {
  try {
    const { name, price, category, ativo } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Nome obrigatório' });
    // Validar categoria contra categorias permitidas (cardápio + custom)
    const allowed = new Set(['geral', 'burguers', 'pizzas', 'porcoes', 'sobremesas', 'bebidas', 'monte-pizza', 'sabores', 'bolinhos']);
    try {
      const cardapio = await lerCardapio();
      if (Array.isArray(cardapio)) cardapio.forEach(i => i.category && allowed.add(i.category));
    } catch (e) {}
    try {
      const data = await fs.readFile(CUSTOM_CATEGORIES_FILE, 'utf8');
      const custom = JSON.parse(data || '[]');
      if (Array.isArray(custom)) custom.forEach(c => c.key && allowed.add(c.key));
    } catch (e) {}

    const chosen = category || 'geral';
    if (!allowed.has(chosen)) return res.status(400).json({ success: false, message: 'Categoria inválida' });

    const addons = await lerAddons();
    addons.push({ name, price: Number(price) || 0, category: chosen, ativo: ativo !== false });
    await salvarAddons(addons);
    res.json({ success: true, message: 'Adicional criado', addons });
  } catch (error) {
    console.error('Erro ao criar addon:', error);
    res.status(500).json({ success: false, message: 'Erro ao criar adicional' });
  }
});

app.put('/api/addons/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const body = req.body;
    const addons = await lerAddons();
    const idx = addons.findIndex(a => a.name === name);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Adicional não encontrado' });
    // Se categoria for alterada, validar
    if (body && body.category) {
      const allowed = new Set(['geral', 'burguers', 'pizzas', 'porcoes', 'sobremesas', 'bebidas', 'monte-pizza', 'sabores', 'bolinhos']);
      try {
        const cardapio = await lerCardapio();
        if (Array.isArray(cardapio)) cardapio.forEach(i => i.category && allowed.add(i.category));
      } catch (e) {}
      try {
        const data = await fs.readFile(CUSTOM_CATEGORIES_FILE, 'utf8');
        const custom = JSON.parse(data || '[]');
        if (Array.isArray(custom)) custom.forEach(c => c.key && allowed.add(c.key));
      } catch (e) {}

      if (!allowed.has(body.category)) return res.status(400).json({ success: false, message: 'Categoria inválida' });
    }

    addons[idx] = { ...addons[idx], ...body };
    await salvarAddons(addons);
    res.json({ success: true, message: 'Adicional atualizado', addons });
  } catch (error) {
    console.error('Erro ao atualizar addon:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar adicional' });
  }
});

app.delete('/api/addons/:name', async (req, res) => {
  try {
    const { name } = req.params;
    let addons = await lerAddons();
    const novo = addons.filter(a => a.name !== name);
    if (novo.length === addons.length) return res.status(404).json({ success: false, message: 'Adicional não encontrado' });
    await salvarAddons(novo);
    res.json({ success: true, message: 'Adicional deletado', addons: novo });
  } catch (error) {
    console.error('Erro ao deletar addon:', error);
    res.status(500).json({ success: false, message: 'Erro ao deletar adicional' });
  }
});

// ==================== ROTAS - PROMOÇÕES POR ITEM ====================

app.get('/api/item-promotions', async (req, res) => {
  try {
    const promotions = await lerItemPromotions();
    res.json({ success: true, promotions });
  } catch (error) {
    console.error('Erro ao buscar promoções:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar promoções' });
  }
});

app.post('/api/item-promotions', async (req, res) => {
  try {
    const { itemName, discount, description, ativo } = req.body;

    if (!itemName || discount === undefined) {
      return res.status(400).json({ success: false, message: 'Dados inválidos' });
    }

    const promotions = await lerItemPromotions();
    
    const existingIndex = promotions.findIndex(p => p.itemName === itemName);
    
    if (existingIndex >= 0) {
      promotions[existingIndex] = { itemName, discount, description: description || '', ativo: ativo !== false };
    } else {
      promotions.push({ itemName, discount, description: description || '', ativo: ativo !== false });
    }

    await salvarItemPromotions(promotions);
    res.json({ success: true, message: 'Promoção salva com sucesso' });
  } catch (error) {
    console.error('Erro ao salvar promoção:', error);
    res.status(500).json({ success: false, message: 'Erro ao salvar promoção' });
  }
});

app.delete('/api/item-promotions/:itemName', async (req, res) => {
  try {
    const { itemName } = req.params;
    const promotions = await lerItemPromotions();
    const filtered = promotions.filter(p => p.itemName !== decodeURIComponent(itemName));
    
    await salvarItemPromotions(filtered);
    res.json({ success: true, message: 'Promoção removida' });
  } catch (error) {
    console.error('Erro ao deletar promoção:', error);
    res.status(500).json({ success: false, message: 'Erro ao deletar promoção' });
  }
});

// ==================== MERCADO PAGO - ASSINATURA ====================

const subscriptionsFile = path.join(__dirname, 'subscriptions.json');

function lerSubscriptions() {
  try {
    if (!fsSync.existsSync(subscriptionsFile)) return [];
    const raw = fsSync.readFileSync(subscriptionsFile, 'utf-8');
    return JSON.parse(raw || '[]');
  } catch (error) {
    console.error('Erro ao ler subscriptions.json:', error.message);
    return [];
  }
}

function salvarSubscriptions(subscriptions) {
  fsSync.writeFileSync(subscriptionsFile, JSON.stringify(subscriptions, null, 2));
}

function upsertSubscription(subscriptionData) {
  const subscriptions = lerSubscriptions();
  const idx = subscriptions.findIndex((s) => String(s.id) === String(subscriptionData.id));

  if (idx >= 0) {
    subscriptions[idx] = { ...subscriptions[idx], ...subscriptionData, updatedAt: new Date().toISOString() };
  } else {
    subscriptions.push({ ...subscriptionData, createdAt: new Date().toISOString() });
  }

  salvarSubscriptions(subscriptions);
}

function requestMercadoPago(method, apiPath, accessToken, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.mercadopago.com',
      path: apiPath,
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    };

    if (payload) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const reqMp = https.request(options, (mpRes) => {
      let data = '';
      mpRes.on('data', (chunk) => {
        data += chunk;
      });
      mpRes.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          if (mpRes.statusCode >= 200 && mpRes.statusCode < 300) {
            resolve(parsed);
            return;
          }

          const msg = parsed?.message || parsed?.error || `Mercado Pago HTTP ${mpRes.statusCode}`;
          reject(new Error(msg));
        } catch (err) {
          reject(new Error(`Falha ao interpretar resposta do Mercado Pago: ${err.message}`));
        }
      });
    });

    reqMp.on('error', (err) => reject(err));

    if (payload) reqMp.write(payload);
    reqMp.end();
  });
}

// Criar assinatura recorrente no Mercado Pago
app.post('/api/criar-assinatura', async (req, res) => {
  try {
    const { email, cardHolder } = req.body;
    const accessToken = process.env.MP_ACCESS_TOKEN;
    const planPrice = Number(process.env.MP_PLAN_PRICE || 280);
    
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email é obrigatório' });
    }

    if (!Number.isFinite(planPrice) || planPrice <= 0) {
      return res.status(500).json({ success: false, error: 'MP_PLAN_PRICE inválido' });
    }
    
    if (!accessToken) {
      return res.status(500).json({ success: false, error: 'Credenciais Mercado Pago não configuradas' });
    }

    console.log('💳 Criando assinatura recorrente para:', email, 'valor:', planPrice);
    
    // Assinatura mensal recorrente via preapproval
    const preapprovalData = {
      reason: 'Plano Pro - Padoca Delivery',
      external_reference: `padoca-plan-${Date.now()}`,
      payer_email: email,
      back_url: `https://${DOMAIN}/painel-admin.html?subscription=success`,
      notification_url: `https://${DOMAIN}/api/mercadopago/webhook`,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: planPrice,
        currency_id: 'BRL'
      },
      status: 'pending'
    };

    const result = await requestMercadoPago('POST', '/preapproval', accessToken, preapprovalData);

    if (!result?.id || !result?.init_point) {
      throw new Error('Mercado Pago não retornou init_point da assinatura');
    }

    upsertSubscription({
      id: result.id,
      email,
      cardHolder: cardHolder || '',
      amount: planPrice,
      status: result.status || 'pending',
      nextPaymentDate: result.next_payment_date || null,
      initPoint: result.init_point,
      type: 'recorrente'
    });

    console.log('✅ Assinatura recorrente criada:', result.id);

    res.json({
      success: true,
      init_point: result.init_point,
      subscription_id: result.id,
      recurring: true
    });
    
  } catch (error) {
    console.error('❌ Erro ao criar assinatura:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Webhook para notificações do Mercado Pago
app.get('/api/mercadopago/webhook', (req, res) => {
  res.json({ 
    status: 200, 
    message: 'Webhook Mercado Pago - Aguardando notificações (use POST)',
    ready: true 
  });
});

app.post('/api/mercadopago/webhook', async (req, res) => {
  try {
    const { type, data, action } = req.body;
    const accessToken = process.env.MP_ACCESS_TOKEN;
    
    console.log('📬 Webhook Mercado Pago recebido:', { type, action, dataId: data?.id });
    
    // Atualizar status local da assinatura com dados oficiais do MP
    const isSubscriptionEvent = (
      type === 'subscription' ||
      type === 'preapproval' ||
      type === 'subscription_preapproval' ||
      String(action || '').toLowerCase().includes('preapproval')
    );

    if (isSubscriptionEvent && data?.id && accessToken) {
      try {
        const sub = await requestMercadoPago('GET', `/preapproval/${data.id}`, accessToken);
        upsertSubscription({
          id: sub.id,
          email: sub.payer_email,
          amount: sub.auto_recurring?.transaction_amount,
          status: sub.status,
          nextPaymentDate: sub.next_payment_date || null,
          externalReference: sub.external_reference || null,
          lastWebhookAt: new Date().toISOString(),
          type: 'recorrente'
        });
        console.log(`🔄 Assinatura atualizada via webhook: ${sub.id} -> ${sub.status}`);
      } catch (subError) {
        console.error('❌ Falha ao sincronizar assinatura no webhook:', subError.message);
      }
    }

    if (type === 'payment' && data?.id) {
      console.log(`✅ Pagamento notificado: ${data.id}`);
    }
    
    // Sempre responder com 200 OK
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Erro ao processar webhook:', error.message);
    // Mesmo com erro, responder com 200 para evitar retry infinito
    res.sendStatus(200);
  }
});

// Verificar status de assinatura
app.get('/api/verificar-assinatura', async (req, res) => {
  try {
    const subscriptions = lerSubscriptions();
    const latest = subscriptions.length > 0 ? subscriptions[subscriptions.length - 1] : null;
    const status = String(latest?.status || '').toLowerCase();
    const active = status === 'authorized' || status === 'active';

    let nextBilling = null;
    if (latest?.nextPaymentDate) {
      const dt = new Date(latest.nextPaymentDate);
      if (!Number.isNaN(dt.getTime())) {
        nextBilling = dt.toLocaleDateString('pt-BR');
      }
    }

    res.json({ 
      active,
      planName: 'Plano Pro',
      price: Number(process.env.MP_PLAN_PRICE || 280),
      nextBilling,
      status: latest?.status || 'none',
      recurring: true
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Status do WhatsApp
app.get('/api/whatsapp-status', (req, res) => {
  res.json({
    connected: whatsappManager.isReady(),
    status: whatsappManager.isReady() ? 'conectado' : 'desconectado',
    queueLength: whatsappManager.messageQueue?.length || 0
  });
});

// Gerar QR code para escanear
app.get('/api/whatsapp-qr', async (req, res) => {
  if (whatsappManager.isReady()) {
    return res.json({ 
      success: false, 
      message: 'WhatsApp já está conectado',
      connected: true 
    });
  }

  try {
    const QRCode = require('qrcode');
    
    // QR code fictício para teste (na prática seria gerado pelo Baileys)
    const qrData = whatsappManager.lastQRData || 'https://padocadodede.com/painel';
    
    const qrImage = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    res.json({ 
      success: true,
      qr: qrImage,
      message: 'Escaneie com seu celular'
    });
  } catch (error) {
    console.error('Erro ao gerar QR:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Status do WhatsApp
app.get('/whatsapp/status', async (req, res) => {
  try {
    const isConnected = whatsappManager.isReady();
    const hasQr = !!whatsappManager.lastQRData;
    
    let qrImage = null;
    if (hasQr) {
      const QRCode = require('qrcode');
      qrImage = await QRCode.toDataURL(whatsappManager.lastQRData, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' }
      });
    }

    res.json({
      connected: isConnected,
      status: isConnected ? 'connected' : (hasQr ? 'qr_ready' : 'disconnected'),
      number: whatsappManager.phoneNumber || null,
      qr: qrImage,
      qr_ready: !isConnected && hasQr
    });
  } catch (error) {
    console.error('Erro ao gerar status WhatsApp:', error);
    res.json({
      connected: false,
      status: 'error',
      number: null,
      qr: null,
      qr_ready: false,
      error: error.message
    });
  }
});

// Desconectar WhatsApp
app.post('/whatsapp/disconnect', async (req, res) => {
  try {
    await whatsappManager.disconnect();
    res.json({ 
      success: true,
      message: 'WhatsApp desconectado com sucesso'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Resetar autenticação e gerar novo QR
app.post('/whatsapp/reset', async (req, res) => {
  try {
    const ok = await whatsappManager.resetAuth();
    res.json({
      success: ok,
      message: ok ? 'WhatsApp resetado. QR novo disponível.' : 'Falha ao resetar WhatsApp'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Enviar mensagem de teste
// Endpoint GET para testar envio de mensagem
app.get('/whatsapp/test-send', async (req, res) => {
  try {
    if (!whatsappManager.isReady()) {
      return res.json({ success: false, message: 'WhatsApp não conectado' });
    }

    const { phone, message } = req.query;
    let destino = (phone || '').replace(/\D/g, '');

    if (!destino) {
      return res.json({ success: false, message: 'Número de telefone não fornecido' });
    }

    const msg = message || `✅ Teste de conexão WhatsApp\n\nPadoca: mensagem automática funcionando!\nHora: ${new Date().toLocaleString('pt-BR')}`;
    console.log(`[WhatsApp] Enviando mensagem de teste para ${destino}...`);
    
    const result = await whatsappManager.sendMessage(destino, msg);

    if (result.success) {
      console.log(`[WhatsApp] ✅ Teste enviado para ${destino}`);
      return res.json({ success: true, message: 'Mensagem enviada com sucesso', phone: destino });
    }

    console.error(`[WhatsApp] ❌ Falha ao enviar para ${destino}: ${result.error}`);
    return res.json({ success: false, message: result.error || 'Falha ao enviar', phone: destino });
  } catch (error) {
    console.error('[WhatsApp] Erro:', error);
    return res.json({ success: false, message: error.message });
  }
});

app.post('/whatsapp/test', async (req, res) => {
  try {
    if (!whatsappManager.isReady()) {
      return res.status(400).json({ success: false, message: 'WhatsApp não conectado' });
    }

    const { number } = req.body || {};
    let destino = (number || '').replace(/\D/g, '');

    if (!destino) {
      const company = await lerCompanyData();
      destino = (company.companyWhatsapp || '').replace(/\D/g, '');
    }

    if (!destino) {
      return res.status(400).json({ success: false, message: 'WhatsApp da empresa não configurado' });
    }

    const mensagem = `✅ Teste de conexão WhatsApp\n\nPadoca: mensagem automática funcionando!\nHora: ${new Date().toLocaleString('pt-BR')}`;
    const result = await whatsappManager.sendMessage(destino, mensagem);

    if (result.success) {
      return res.json({ success: true, message: 'Mensagem enviada' });
    }

    return res.status(500).json({ success: false, message: result.error || 'Falha ao enviar' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== IMPRESSORA ====================

// Arquivo de configuração de impressora
const PRINTER_CONFIG_FILE = path.join(__dirname, 'printer-config.json');

// Ler configuração de impressora
async function lerConfiguracaoImpressora() {
  try {
    if (await fs.access(PRINTER_CONFIG_FILE).catch(() => false)) {
      const data = await fs.readFile(PRINTER_CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Erro ao ler config impressora:', error.message);
  }
  return {
    enabled: false,
    selectedPrinter: null,
    autoprint: false,
    testMode: false
  };
}

// Salvar configuração de impressora
async function salvarConfiguracaoImpressora(config) {
  try {
    await fs.writeFile(PRINTER_CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Erro ao salvar config impressora:', error.message);
    throw error;
  }
}

// Obter configuração de impressora
app.get('/api/printer/config', async (req, res) => {
  try {
    const config = await lerConfiguracaoImpressora();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Salvar configuração de impressora
app.post('/api/printer/config', async (req, res) => {
  try {
    const { enabled, selectedPrinter, autoprint } = req.body;
    
    const config = await lerConfiguracaoImpressora();
    config.enabled = !!enabled;
    config.selectedPrinter = selectedPrinter || null;
    config.autoprint = !!autoprint;
    
    await salvarConfiguracaoImpressora(config);
    
    res.json({ 
      success: true, 
      message: 'Configuração salva com sucesso',
      config 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Testar impressão
app.post('/api/printer/test', async (req, res) => {
  try {
    const config = await lerConfiguracaoImpressora();
    
    if (!config.enabled) {
      return res.status(400).json({ 
        error: 'Impressão não habilitada' 
      });
    }
    
    // Simulação de teste (em produção, teria integração real)
    console.log(`🖨️ Teste de impressão: ${config.selectedPrinter || 'Padrão'}`);
    
    res.json({ 
      success: true,
      message: 'Página de teste enviada para impressora'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Listar impressoras disponíveis do sistema
app.get('/api/printer/list', (req, res) => {
  try {
    const { exec } = require('child_process');
    const platform = process.platform;
    
    if (platform === 'win32') {
      // Windows - tentar múltiplos métodos para detectar impressoras
      const cmd = `powershell -Command "
        $printers = @()
        try {
          $printers += Get-Printer -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name
        } catch {}
        try {
          $wmi = Get-WmiObject Win32_Printer -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name
          if ($wmi) { $printers += $wmi }
        } catch {}
        try {
          $devices = Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Devices' -ErrorAction SilentlyContinue | Select-Object -Property * -ExcludeProperty PS*
          if ($devices) {
            $devices.PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' } | ForEach-Object { $printers += $_.Name }
          }
        } catch {}
        $printers | Select-Object -Unique | ConvertTo-Json
      "`;
      
      exec(cmd, (error, stdout, stderr) => {
        try {
          let printers = [];
          
          if (stdout && stdout.trim()) {
            try {
              const result = JSON.parse(stdout);
              if (Array.isArray(result)) {
                printers = result.map(p => ({ name: p, id: p }));
              } else if (typeof result === 'string') {
                printers = [{ name: result, id: result }];
              }
            } catch (e) {
              // Se não for JSON válido, tenta parsear como texto simples
              const lines = stdout.trim().split('\n').filter(l => l.trim());
              printers = lines.map(p => ({ name: p.trim(), id: p.trim() }));
            }
          }
          
          // Remover duplicatas e vazio
          printers = printers.filter((p, i, a) => p.name && a.findIndex(x => x.name === p.name) === i);
          
          // Adicionar impressora padrão sempre
          printers.unshift({ name: 'Impressora Padrão do Sistema', id: 'default' });
          console.log('[PrinterAPI] Windows printers found:', printers);
          res.json(printers);
        } catch (e) {
          console.error('[PrinterAPI] Erro ao parsear impressoras Windows:', e.message);
          res.json([{ name: 'Impressora Padrão do Sistema', id: 'default' }]);
        }
      });
    } else if (platform === 'darwin') {
      // macOS
      exec('lpstat -p -d', (error, stdout, stderr) => {
        try {
          let printers = [];
          
          if (!error && stdout) {
            const lines = stdout.split('\n');
            printers = lines
              .filter(line => line.startsWith('printer'))
              .map(line => {
                const name = line.split(/\s+/)[1];
                return { name, id: name };
              });
          }
          
          printers.unshift({ name: 'Impressora Padrão do Sistema', id: 'default' });
          console.log('[PrinterAPI] macOS printers found:', printers);
          res.json(printers);
        } catch (e) {
          console.error('[PrinterAPI] Erro ao parsear impressoras macOS:', e.message);
          res.json([{ name: 'Impressora Padrão do Sistema', id: 'default' }]);
        }
      });
    } else {
      // Linux
      exec('lpstat -p -d', (error, stdout, stderr) => {
        try {
          let printers = [];
          
          if (!error && stdout) {
            const lines = stdout.split('\n');
            printers = lines
              .filter(line => line.startsWith('printer'))
              .map(line => {
                const name = line.split(/\s+/)[1];
                return { name, id: name };
              });
          }
          
          printers.unshift({ name: 'Impressora Padrão do Sistema', id: 'default' });
          console.log('[PrinterAPI] Linux printers found:', printers);
          res.json(printers);
        } catch (e) {
          console.error('[PrinterAPI] Erro ao parsear impressoras Linux:', e.message);
          res.json([{ name: 'Impressora Padrão do Sistema', id: 'default' }]);
        }
      });
    }
  } catch (error) {
    console.error('[PrinterAPI] Erro geral:', error.message);
    res.json([{ name: 'Impressora Padrão do Sistema', id: 'default' }]);
  }
});

// ==================== INICIALIZAR ====================

async function iniciarServidor() {
  try {
    await inicializarArquivos();
    console.log('✅ Arquivos inicializados');

    // Inicializar WhatsApp com Baileys
    console.log('\n[WhatsApp] Iniciando gerenciador Baileys...');
    const whatsappReady = await whatsappManager.initialize();
    if (!whatsappReady) {
      console.warn('[WhatsApp] ⚠️ WhatsApp não inicializado. Interface disponível no painel admin.');
    }

    // Criar instância do PrintService apenas quando habilitado explicitamente
    if (ENABLE_SERVER_PRINT_SERVICE) {
      const apiUrl = HTTPS_ENABLED ? `https://${DOMAIN}` : `http://localhost:${PORT}`;
      printService = new PrintService(apiUrl);
    }

    // Servidor HTTP
    app.listen(PORT, '0.0.0.0', () => {
      console.log('\n🍞 ========================================');
      console.log('   PADOCA ONLINE - Servidor Único');
      console.log('========================================');
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`📍 URL: http://localhost:${PORT}`);
      console.log(`🌐 Rede: http://127.0.0.1:${PORT}`);
      if (HTTPS_ENABLED) {
        console.log(`🔒 HTTPS: https://${DOMAIN}`);
      }
      console.log(`\n📄 Site: http://localhost:${PORT}/index.html`);
      console.log(`⚙️  Painel Admin: http://localhost:${PORT}/painel-admin.html`);
      console.log('========================================\n');

      // Serviços ativos
      console.log('📱 WhatsApp: Baileys ativo');
      if (ENABLE_SERVER_PRINT_SERVICE && printService) {
        console.log('🖨️  Impressora: Serviço integrado ativo\n');
      } else {
        console.log('🖨️  Impressora: Serviço integrado desativado (use agente local)\n');
      }

      // Inicializar PrintService APÓS servidor estar pronto (se habilitado)
      if (ENABLE_SERVER_PRINT_SERVICE && printService) {
        printService.start();
      }
    });

    if (HTTPS_ENABLED) {
      const httpsOptions = {
        key: fsSync.readFileSync(`${HTTPS_CERT_DIR}/privkey.pem`),
        cert: fsSync.readFileSync(`${HTTPS_CERT_DIR}/fullchain.pem`)
      };

      https.createServer(httpsOptions, app).listen(443, '0.0.0.0', () => {
        console.log(`✅ HTTPS ativo em https://${DOMAIN}`);
      });
    }
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

iniciarServidor();
