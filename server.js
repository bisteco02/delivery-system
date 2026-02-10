/**
 * Servidor de Delivery
 * Backend: Site + Painel Admin + API WhatsApp
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcryptjs');
const forceHttps = require('express-force-https');
const selfsigned = require('selfsigned');

const app = express();
const PORT = process.env.PORT || 3001;
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY || 'padoca-local-2026';

// Configurar sessões
app.use(session({
  secret: process.env.SESSION_SECRET || 'padoca-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  store: new SQLiteStore(),
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 horas
}));

// Forçar HTTPS em produção
if (process.env.NODE_ENV === 'production') {
  app.use(forceHttps);
}

// ==================== CONFIGURAÇÕES ====================

// Configurar multer para upload de imagens
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Para forms

// Configurações do Admin
const ADMIN_USUARIO = process.env.ADMIN_USER || 'admin';
const ADMIN_SENHA_HASH = bcrypt.hashSync(process.env.ADMIN_PASS || 'admin123', 10);
const ADMIN_DOMAIN = process.env.ADMIN_DOMAIN || '';
const ADMIN_BYPASS_TOKEN = process.env.ADMIN_TOKEN || '';

app.use((req, res, next) => {
  const adminPaths = ['/painel-admin.html', '/painel-admin.js', '/painel-admin.css', '/painel-admin'];
  const isAdminRequest = adminPaths.some(p => req.path === p || req.path.startsWith(p + '/'));
  if (!isAdminRequest) return next();

  const host = (req.headers.host || '').split(':')[0];
  // Permitido se o Host corresponder ao domínio configurado
  if (ADMIN_DOMAIN && host === ADMIN_DOMAIN) return next();

  // Verificar sessão de login
  if (req.session.adminLoggedIn) return next();

  // Token de bypass via header ou query
  const token = req.headers['x-admin-token'] || req.query.admin_token;
  if (ADMIN_BYPASS_TOKEN && token === ADMIN_BYPASS_TOKEN) return next();

  // Redirecionar para login
  if (req.path === '/painel-admin.html') {
    return res.redirect('/login');
  }
  return res.status(403).send('Acesso restrito. Faça login em /login.');
});

app.use(express.static('.')); // Servir arquivos estáticos
app.use('/uploads', express.static(uploadsDir)); // Servir uploads

// Rota para favicon (evitar erro 404)
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// ==================== AUTENTICAÇÃO ADMIN ====================

// Rota GET /login
app.get('/login', (req, res) => {
  if (req.session.adminLoggedIn) return res.redirect('/painel-admin.html');
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
      <meta charset="UTF-8">
      <title>Login - Painel Admin</title>
      <style>
        body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f4f4f4; margin: 0; }
        .container { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 0 20px rgba(0,0,0,0.1); width: 300px; text-align: center; }
        h2 { color: #333; margin-bottom: 20px; }
        input { display: block; margin: 10px auto; padding: 10px; width: 100%; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #28a745; color: white; padding: 10px; border: none; width: 100%; border-radius: 4px; cursor: pointer; margin-top: 10px; }
        button:hover { background: #218838; }
        .error { color: red; margin-top: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>🍞 Login no Painel Admin</h2>
        <form action="/login" method="POST">
          <input type="text" name="usuario" placeholder="Usuário" required>
          <input type="password" name="senha" placeholder="Senha" required>
          <button type="submit">Entrar</button>
        </form>
        <p>Configure as credenciais no arquivo .env</p>
      </div>
    </body>
    </html>
  `);
});

// Rota POST /login
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
      <title>Erro - Login</title>
      <style>
        body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f4f4f4; margin: 0; }
        .container { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 0 20px rgba(0,0,0,0.1); width: 300px; text-align: center; }
        h2 { color: #dc3545; }
        a { color: #007bff; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Credenciais inválidas</h2>
        <p><a href="/login">Tentar novamente</a></p>
      </div>
    </body>
    </html>
  `);
});

// Rota /logout
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Erro ao fazer logout:', err);
    res.redirect('/login');
  });
});

// ==================== WHATSAPP ====================

let whatsappClient = null;
let qrCodeData = null;
let isWhatsAppConnected = false;
let connectionStatus = 'initializing';

async function inicializarWhatsApp() {
  try {
    console.log('Iniciando WhatsApp...');
    
    whatsappClient = new Client({
      authStrategy: new LocalAuth({
        dataPath: path.join(__dirname, '.wwebjs_auth')
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process', // Pode ajudar em alguns casos
          '--disable-gpu'
        ],
        timeout: 60000 // Timeout de 60 segundos para inicialização
      }
    });

    whatsappClient.on('qr', async (qr) => {
      qrCodeData = qr;
      connectionStatus = 'qr_ready';
      console.log('QR Code gerado: http://localhost:' + PORT + '/whatsapp/qr');
    });

    whatsappClient.on('ready', async () => {
      isWhatsAppConnected = true;
      connectionStatus = 'connected';
      qrCodeData = null;
      console.log('✅ WhatsApp conectado!');

      // Verificar se o número conectado é o da empresa
      try {
        const info = whatsappClient.info;
        if (info && info.wid && info.wid.user) {
          const numeroConectado = info.wid.user;
          console.log('📱 Número WhatsApp conectado:', numeroConectado);

          const companyData = await lerCompanyData();
          if (companyData && companyData.companyWhatsapp) {
            const numeroEmpresa = companyData.companyWhatsapp.replace(/\D/g, '');
            if (numeroConectado !== numeroEmpresa) {
              console.warn(`⚠️  AVISO: O WhatsApp conectado (${numeroConectado}) não é o da empresa (${numeroEmpresa}). Configure o número correto no painel admin.`);
            } else {
              console.log('✅ WhatsApp da empresa conectado corretamente!');
            }
          }
        }
      } catch (error) {
        console.error('Erro ao verificar número WhatsApp:', error);
      }
    });

    whatsappClient.on('authenticated', () => {
      console.log('🔐 WhatsApp autenticado!');
    });

    whatsappClient.on('auth_failure', (msg) => {
      console.error('❌ Falha na autenticação WhatsApp:', msg);
      connectionStatus = 'auth_failed';
    });

    whatsappClient.on('disconnected', () => {
      isWhatsAppConnected = false;
      connectionStatus = 'disconnected';
      console.log('⚠️  WhatsApp desconectado');
    });

    await Promise.race([
      whatsappClient.initialize(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout na inicialização do WhatsApp')), 120000) // 2 minutos
      )
    ]);
  } catch (error) {
    console.error('❌ Erro ao inicializar WhatsApp:', error);
    connectionStatus = 'error';
    // Resetar cliente para evitar estado inconsistente
    if (whatsappClient) {
      try {
        whatsappClient.destroy();
      } catch (e) {
        console.error('Erro ao destruir cliente WhatsApp:', e);
      }
      whatsappClient = null;
    }
    throw error; // Re-throw para o catch externo
  }
}

// Middleware de autenticação WhatsApp API
function autenticarWhatsAppAPI(req, res, next) {
  const apiKey = req.headers['apikey'] || req.headers['authorization'];
  if (apiKey === WHATSAPP_API_KEY) {
    next();
  } else {
    res.status(401).json({ error: 'API Key inválida' });
  }
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

// ========== ADDONS (ADICIONAIS) ==========
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


// ==================== UTILIDADES ====================

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

// ==================== ROTAS - LOGIN ====================

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

// ==================== ROTAS - PEDIDOS ====================

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

    console.log('Novo pedido:', novoPedido.id);

    // Enviar WhatsApp para a empresa se configurado
    try {
      const companyData = await lerCompanyData();
      if (companyData && companyData.companyWhatsapp && isWhatsAppConnected) {
        const numeroEmpresa = companyData.companyWhatsapp.replace(/\D/g, '');
        const chatIdEmpresa = `55${numeroEmpresa}@c.us`;
        const mensagemEmpresa = `🍞 *NOVO PEDIDO #${novoPedido.id}*\n\n👤 Cliente: ${novoPedido.cliente.nome}\n📱 WhatsApp: ${novoPedido.cliente.whatsapp}\n📍 Endereço: ${novoPedido.endereco || 'Não informado'}\n💰 Total: R$ ${novoPedido.total.toFixed(2)}\n\n📋 Itens:\n${novoPedido.itens.map(item => `- ${item.quantidade}x ${item.nome} (R$ ${item.precoTotal.toFixed(2)})`).join('\n')}\n\n⚡ Acesse o painel para confirmar!`;
        
        await whatsappClient.sendMessage(chatIdEmpresa, mensagemEmpresa);
        console.log('Notificação enviada para:', numeroEmpresa);
      }
    } catch (error) {
      console.error('Erro ao enviar WhatsApp para empresa:', error);
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

// ==================== ROTAS - WHATSAPP API ====================

app.get('/whatsapp/status', autenticarWhatsAppAPI, (req, res) => {
  res.json({
    success: true,
    connected: isWhatsAppConnected,
    status: connectionStatus
  });
});

app.get('/whatsapp/qr', async (req, res) => {
  if (!qrCodeData) {
    return res.send(`
      <!DOCTYPE html>
      <html><head><meta charset="UTF-8"><title>WhatsApp QR</title>
      <style>body{font-family:Arial;text-align:center;padding:50px;background:#667eea;color:#fff}
      .card{background:rgba(255,255,255,0.1);padding:30px;border-radius:15px;max-width:500px;margin:0 auto}</style>
      </head><body><div class="card">
      <h1>📱 WhatsApp</h1>
      <p>${connectionStatus === 'connected' ? '✅ Já conectado!' : '⏳ Aguardando QR Code...'}</p>
      <p><a href="/whatsapp/qr" style="color:#fff">🔄 Recarregar</a></p>
      </div></body></html>
    `);
  }

  try {
    const qrImage = await QRCode.toDataURL(qrCodeData);
    res.send(`
      <!DOCTYPE html>
      <html><head><meta charset="UTF-8"><title>WhatsApp QR Code</title>
      <style>body{font-family:Arial;text-align:center;padding:20px;background:#667eea;color:#fff}
      .card{background:rgba(255,255,255,0.1);padding:30px;border-radius:15px;max-width:600px;margin:0 auto}
      img{max-width:400px;margin:20px auto;background:#fff;padding:20px;border-radius:10px}</style>
      </head><body><div class="card">
      <h1>📱 Conectar WhatsApp</h1>
      <p>Escaneie este QR Code com seu WhatsApp</p>
      <img src="${qrImage}" alt="QR Code">
      <p style="font-size:14px;opacity:0.8">A página recarregará automaticamente em 5 segundos</p>
      </div><script>setTimeout(() => location.reload(), 5000)</script></body></html>
    `);
  } catch (error) {
    res.status(500).send('Erro ao gerar QR Code');
  }
});

app.post('/whatsapp/send', autenticarWhatsAppAPI, async (req, res) => {
  try {
    if (!isWhatsAppConnected) {
      return res.status(503).json({
        success: false,
        message: 'WhatsApp não está conectado'
      });
    }

    const { number, message } = req.body;
    
    if (!number || !message) {
      return res.status(400).json({
        success: false,
        message: 'Número e mensagem são obrigatórios'
      });
    }

    const chatId = number.includes('@c.us') ? number : `55${number.replace(/\D/g, '')}@c.us`;
    await whatsappClient.sendMessage(chatId, message);

    res.json({
      success: true,
      message: 'Mensagem enviada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao enviar mensagem: ' + error.message
    });
  }
});

// Status do WhatsApp
app.get('/whatsapp/status', (req, res) => {
  res.json({
    connected: isWhatsAppConnected,
    qr: qrCodeData,
    number: whatsappClient?.info?.wid?.user || null,
    status: connectionStatus
  });
});

// Desconectar WhatsApp
app.post('/whatsapp/disconnect', (req, res) => {
  try {
    if (whatsappClient) {
      whatsappClient.logout();
      isWhatsAppConnected = false;
      connectionStatus = 'disconnected';
      qrCodeData = null;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== INICIALIZAR ====================

async function iniciarServidor() {
  try {
    await inicializarArquivos();
    console.log('✅ Arquivos inicializados');

    // Servidor HTTP
    app.listen(PORT, 'localhost', () => {
      console.log('\n🍞 ========================================');
      console.log('   PADOCA ONLINE - Servidor Único');
      console.log('========================================');
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`📍 URL: http://localhost:${PORT}`);
      console.log(`🌐 Rede: http://127.0.0.1:${PORT}`);
      console.log(`\n📄 Site: http://localhost:${PORT}/index.html`);
      console.log(`⚙️  Painel Admin: http://localhost:${PORT}/painel-admin.html`);
      console.log(`📱 WhatsApp QR: http://localhost:${PORT}/whatsapp/qr`);
      console.log(`🔑 API Key WhatsApp: ${WHATSAPP_API_KEY}`);
      console.log('========================================\n');

      // Inicializar WhatsApp em background (desabilitado localmente - ativar na hospedagem)
      // setTimeout(async () => {
      //   try {
      //     console.log('⏳ Tentando inicializar WhatsApp...');
      //     await inicializarWhatsApp();
      //     console.log('✅ WhatsApp inicializado com sucesso');
      //   } catch (err) {
      //     console.error('❌ Falha crítica no WhatsApp, continuando sem ele:', err.message);
      //     // Resetar variáveis para evitar estado inconsistente
      //     whatsappClient = null;
      //     qrCodeData = null;
      //     isWhatsAppConnected = false;
      //     connectionStatus = 'error';
      //   }
      // }, 2000); // Delay maior para garantir que o servidor esteja totalmente pronto
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

iniciarServidor();
