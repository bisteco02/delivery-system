const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const { dbGet, dbAll, dbRun } = require('./database');

const app = express();
const PORT = 3001;

// Configurar multer para upload de imagens
const uploadsDir = path.join(__dirname, 'uploads');

async function inicializarUploadsDir() {
  try {
    await fs.access(uploadsDir);
  } catch {
    await fs.mkdir(uploadsDir, { recursive: true });
  }
}

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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));
app.use('/uploads', express.static(uploadsDir));
app.use('/:tenantSlug/assets', express.static(path.join(__dirname, 'assets')));
app.use('/:tenantSlug/styles', express.static(path.join(__dirname, 'styles')));
app.use('/:tenantSlug/uploads', express.static(uploadsDir));
app.get('/:tenantSlug/painel-admin.js', (req, res, next) => {
  if (reservedSlugs.includes(req.params.tenantSlug)) return next();
  res.sendFile(path.join(__dirname, 'painel-admin.js'));
});

// Rotas amigáveis por slug (/padoca-do-dede, /padoca-do-dede/checkout)
const reservedSlugs = ['api', 'uploads', 'styles', 'assets', 'node_modules'];
const DEFAULT_TENANT = process.env.DEFAULT_TENANT_SLUG || 'padoca-do-dede';
app.get(['/:tenantSlug', '/:tenantSlug/index.html', '/:tenantSlug/checkout.html', '/:tenantSlug/painel-admin.html'], (req, res, next) => {
  if (reservedSlugs.includes(req.params.tenantSlug)) return next();
  const page = req.path.includes('checkout.html')
    ? 'checkout.html'
    : req.path.includes('painel-admin.html')
      ? 'painel-admin.html'
      : 'index.html';
  res.sendFile(path.join(__dirname, page));
});

// MIDDLEWARE PARA IDENTIFICAR TENANT
async function identificarTenant(req, res, next) {
  try {
    let tenantSlug = null;
    
    // Método 1: Por subdomínio (ex: padoca1.seusite.com.br)
    const host = req.headers.host || '';
    const subdomain = host.split('.')[0];
    
    // Método 2: Por path (ex: /padoca1/...)
    const pathMatch = req.path.match(/^\/([a-z0-9-]+)\//);
    
    // Método 3: Por parâmetro/header (para testes)
    tenantSlug = req.query.tenant || req.headers['x-tenant'] || pathMatch?.[1] || subdomain;
    
    // Se não encontrou tenant, usa o default configurável
    if (!tenantSlug || tenantSlug === 'localhost' || tenantSlug.includes(':')) {
      tenantSlug = DEFAULT_TENANT;
    }
    
    // Buscar tenant no banco
    const tenant = await dbGet('SELECT * FROM tenants WHERE slug = ? AND ativo = 1', [tenantSlug]);
    
    if (!tenant) {
      console.log(`❌ Tenant não encontrado: ${tenantSlug}`);
      return res.status(404).json({ 
        erro: 'Estabelecimento não encontrado',
        slug: tenantSlug 
      });
    }
    
    // Log apenas para APIs, não para assets estáticos
    if (req.path.startsWith('/api/')) {
      console.log(`✅ Tenant: ${tenant.slug} (ID: ${tenant.id}) - ${req.method} ${req.path}`);
    }
    
    // Adicionar tenant na requisição
    req.tenant = tenant;
    req.tenantId = tenant.id;
    next();
  } catch (error) {
    console.error('Erro ao identificar tenant:', error);
    res.status(500).json({ erro: 'Erro ao identificar estabelecimento' });
  }
}

// ========================================
// ROTAS PÚBLICAS (sem tenant)
// ========================================

// Rota para listar todos os tenants (para landing page)
app.get('/api/tenants-publicos', async (req, res) => {
  try {
    const tenants = await dbAll(`
      SELECT id, slug, nome, logo, telefone, endereco
      FROM tenants 
      WHERE ativo = 1
      ORDER BY nome
    `);
    res.json(tenants);
  } catch (error) {
    console.error('Erro ao listar tenants:', error);
    res.status(500).json({ erro: 'Erro ao listar estabelecimentos' });
  }
});

// Rota para criar novo tenant (cadastro)
app.post('/api/tenants/cadastrar', async (req, res) => {
  try {
    const { slug, nome, email, telefone, senha } = req.body;
    
    // Validações
    if (!slug || !nome || !email || !senha) {
      return res.status(400).json({ erro: 'Dados obrigatórios faltando' });
    }
    
    // Verificar se slug já existe
    const existente = await dbGet('SELECT id FROM tenants WHERE slug = ?', [slug]);
    if (existente) {
      return res.status(400).json({ erro: 'Este identificador já está em uso' });
    }
    
    // Criar tenant
    const resultado = await dbRun(`
      INSERT INTO tenants (slug, nome, email, telefone, ativo, plano, data_expiracao)
      VALUES (?, ?, ?, ?, 1, 'basico', datetime('now', '+30 days'))
    `, [slug, nome, email, telefone]);
    
    const tenantId = resultado.id;
    
    // Criar usuário admin para o tenant
    const senhaHash = require('crypto').createHash('md5').update(senha).digest('hex');
    await dbRun(`
      INSERT INTO usuarios (tenant_id, nome, email, senha, tipo)
      VALUES (?, ?, ?, ?, 'admin')
    `, [tenantId, nome, email, senhaHash]);
    
    // Criar categorias padrão
    const categoriasDefault = ['Pães', 'Bolos', 'Salgados', 'Bebidas'];
    for (let i = 0; i < categoriasDefault.length; i++) {
      await dbRun(`
        INSERT INTO categorias (tenant_id, nome, ordem)
        VALUES (?, ?, ?)
      `, [tenantId, categoriasDefault[i], i]);
    }
    
    res.json({ 
      sucesso: true, 
      tenant_id: tenantId,
      slug: slug,
      mensagem: 'Estabelecimento cadastrado com sucesso!',
      url: `/${slug}`
    });
  } catch (error) {
    console.error('Erro ao cadastrar tenant:', error);
    res.status(500).json({ erro: 'Erro ao cadastrar estabelecimento' });
  }
});

// ========================================
// ROTAS COM TENANT (identificação automática)
// ========================================

// Aplicar middleware de tenant em todas as rotas abaixo
app.use('/api', identificarTenant);

// CARDÁPIO
app.get('/api/cardapio', async (req, res) => {
  try {
    const categorias = await dbAll(`
      SELECT * FROM categorias 
      WHERE tenant_id = ? AND ativo = 1 
      ORDER BY ordem, nome
    `, [req.tenantId]);
    
    const produtos = await dbAll(`
      SELECT * FROM produtos 
      WHERE tenant_id = ?
      ORDER BY ordem, nome
    `, [req.tenantId]);
    
    const slugify = (str = '') => str.toString().toLowerCase().normalize('NFD').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
    const categoriaPorId = new Map();
    categorias.forEach(c => categoriaPorId.set(c.id, slugify(c.nome || 'outros')));

    let cardapioArray = produtos.map(p => ({
      name: p.nome,
      category: p.categoria_id ? (categoriaPorId.get(p.categoria_id) || 'outros') : 'outros',
      price: p.preco,
      image: p.imagem,
      description: p.descricao,
      ativo: p.disponivel === 1
    }));

    // Fallback: se não houver produtos no banco, carregar cardápio do backup
    if (cardapioArray.length === 0) {
      try {
        const backupPath = path.join(__dirname, '_backup', 'cardapio.json');
        const raw = await fs.readFile(backupPath, 'utf-8');
        const backup = JSON.parse(raw);
        if (Array.isArray(backup) && backup.length > 0) {
          cardapioArray = backup.map((item, idx) => ({
            name: item.name,
            category: item.category || 'outros',
            price: item.price || 0,
            image: item.image || '',
            description: item.description || '',
            ativo: item.ativo !== false,
            ordem: idx
          }));
          console.log('⚠️ Cardápio retornado do backup (_backup/cardapio.json)');
        }
      } catch (err) {
        console.warn('⚠️ Não foi possível carregar cardápio de backup:', err.message);
      }
    }
    
    res.json({ success: true, cardapio: cardapioArray });
  } catch (error) {
    console.error('Erro ao buscar cardápio:', error);
    res.status(500).json({ erro: 'Erro ao buscar cardápio' });
  }
});

// Atualizar cardápio inteiro (substitui todos os produtos do tenant)
app.post('/api/cardapio', async (req, res) => {
  const { cardapio } = req.body || {};
  if (!Array.isArray(cardapio)) {
    return res.status(400).json({ success: false, message: 'Formato inválido: esperado { cardapio: [] }' });
  }

  const slugify = (str = '') => str.toString().toLowerCase().normalize('NFD').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
  const titleize = (slug = '') => slug.replace(/-/g, ' ').replace(/\b\w/g, m => m.toUpperCase()).trim();

  try {
    // Limpa produtos existentes do tenant
    await dbRun('DELETE FROM produtos WHERE tenant_id = ?', [req.tenantId]);

    // Mapa de categorias existentes por slug
    const categorias = await dbAll('SELECT id, nome FROM categorias WHERE tenant_id = ?', [req.tenantId]);
    const catSlugToId = new Map();
    categorias.forEach(c => catSlugToId.set(slugify(c.nome || ''), c.id));

    // Insere cada item
    for (let i = 0; i < cardapio.length; i++) {
      const item = cardapio[i] || {};
      const catSlug = slugify(item.category || 'outros');

      // Garante categoria
      let categoriaId = catSlugToId.get(catSlug) || null;
      if (!categoriaId) {
        const nomeCat = titleize(catSlug || 'Outros') || 'Outros';
        const inserted = await dbRun(
          'INSERT INTO categorias (tenant_id, nome, ordem, ativo) VALUES (?, ?, ?, 1)',
          [req.tenantId, nomeCat, i]
        );
        categoriaId = inserted.id;
        catSlugToId.set(catSlug, categoriaId);
      }

      await dbRun(`
        INSERT INTO produtos (
          tenant_id, categoria_id, nome, descricao, preco, preco_promocional, imagem, disponivel, ordem
        ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)
      `, [
        req.tenantId,
        categoriaId,
        item.name || 'Item',
        item.description || '',
        item.price || 0,
        item.image || '',
        item.ativo === false ? 0 : 1,
        i
      ]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao salvar cardápio:', error);
    res.status(500).json({ success: false, message: 'Erro ao salvar cardápio' });
  }
});

// PRODUTOS
app.post('/api/produtos', upload.single('imagem'), async (req, res) => {
  try {
    const { nome, descricao, preco, categoria_id, preco_promocional } = req.body;
    const imagem = req.file ? `/uploads/${req.file.filename}` : null;
    
    const resultado = await dbRun(`
      INSERT INTO produtos (tenant_id, categoria_id, nome, descricao, preco, preco_promocional, imagem)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [req.tenantId, categoria_id, nome, descricao, preco, preco_promocional, imagem]);
    
    res.json({ sucesso: true, id: resultado.id });
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    res.status(500).json({ erro: 'Erro ao criar produto' });
  }
});

app.put('/api/produtos/:id', upload.single('imagem'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, descricao, preco, categoria_id, preco_promocional, disponivel } = req.body;
    const imagem = req.file ? `/uploads/${req.file.filename}` : req.body.imagem;
    
    await dbRun(`
      UPDATE produtos 
      SET nome = ?, descricao = ?, preco = ?, categoria_id = ?, 
          preco_promocional = ?, imagem = ?, disponivel = ?
      WHERE id = ? AND tenant_id = ?
    `, [nome, descricao, preco, categoria_id, preco_promocional, imagem, disponivel ? 1 : 0, id, req.tenantId]);
    
    res.json({ sucesso: true });
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    res.status(500).json({ erro: 'Erro ao atualizar produto' });
  }
});

app.delete('/api/produtos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun('DELETE FROM produtos WHERE id = ? AND tenant_id = ?', [id, req.tenantId]);
    res.json({ sucesso: true });
  } catch (error) {
    console.error('Erro ao deletar produto:', error);
    res.status(500).json({ erro: 'Erro ao deletar produto' });
  }
});

// CATEGORIAS
app.get('/api/categorias', async (req, res) => {
  try {
    const categorias = await dbAll(`
      SELECT * FROM categorias 
      WHERE tenant_id = ? 
      ORDER BY ordem, nome
    `, [req.tenantId]);
    res.json(categorias);
  } catch (error) {
    console.error('Erro ao buscar categorias:', error);
    res.status(500).json({ erro: 'Erro ao buscar categorias' });
  }
});

app.post('/api/categorias', async (req, res) => {
  try {
    const { nome, ordem } = req.body;
    const resultado = await dbRun(`
      INSERT INTO categorias (tenant_id, nome, ordem)
      VALUES (?, ?, ?)
    `, [req.tenantId, nome, ordem || 0]);
    res.json({ sucesso: true, id: resultado.id });
  } catch (error) {
    console.error('Erro ao criar categoria:', error);
    res.status(500).json({ erro: 'Erro ao criar categoria' });
  }
});

// PEDIDOS
app.post('/api/pedidos', async (req, res) => {
  try {
    const { cliente_nome, cliente_telefone, cliente_endereco, itens, total, forma_pagamento, observacoes } = req.body;
    
    console.log('📦 Recebendo pedido:', { cliente_nome, total, forma_pagamento, itens_count: itens?.length });
    
    const numero_pedido = `PED-${Date.now()}`;
    const itensJson = JSON.stringify(itens);
    
    const resultado = await dbRun(`
      INSERT INTO pedidos (
        tenant_id, numero_pedido, cliente_nome, cliente_telefone, 
        cliente_endereco, itens, total, forma_pagamento, observacoes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente')
    `, [req.tenantId, numero_pedido, cliente_nome, cliente_telefone, cliente_endereco, itensJson, total, forma_pagamento, observacoes]);
    
    console.log('✅ Pedido criado:', numero_pedido);
    res.json({ success: true, pedido: { id: resultado.id, numero_pedido } });
  } catch (error) {
    console.error('❌ Erro ao criar pedido:', error);
    res.status(500).json({ success: false, message: error.message || 'Erro ao criar pedido' });
  }
});

app.get('/api/pedidos', async (req, res) => {
  try {
    console.log('📋 GET /api/pedidos - Tenant:', req.tenant?.slug || req.tenantId);
    
    const pedidos = await dbAll(`
      SELECT * FROM pedidos 
      WHERE tenant_id = ? 
      ORDER BY data_pedido DESC
    `, [req.tenantId]);
    
    console.log(`✅ ${pedidos.length} pedidos encontrados`);
    
    // Formatar pedidos para compatibilidade com frontend
    const pedidosFormatados = pedidos.map(p => {
      const itens = p.itens ? JSON.parse(p.itens) : [];
      
      return {
        id: p.id,
        numero_pedido: p.numero_pedido,
        status: p.status,
        data: p.data_pedido,
        total: p.total,
        observacoes: p.observacoes,
        tipoEntrega: p.cliente_endereco === 'Retirada no balcão' ? 'retirada' : 'delivery',
        endereco: p.cliente_endereco,
        bairro: p.cliente_endereco && p.cliente_endereco !== 'Retirada no balcão' ? p.cliente_endereco.split(',').pop().trim() : '',
        cliente: {
          nome: p.cliente_nome,
          whatsapp: p.cliente_telefone
        },
        pagamento: {
          forma: p.forma_pagamento || 'nao informado'
        },
        itens: itens
      };
    });
    
    res.json({ success: true, pedidos: pedidosFormatados });
  } catch (error) {
    console.error('❌ Erro ao buscar pedidos:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar pedidos' });
  }
});

app.patch('/api/pedidos/:id', identificarTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Buscar dados do pedido antes de atualizar
    const pedido = await dbGet(`
      SELECT * FROM pedidos WHERE id = ? AND tenant_id = ?
    `, [id, req.tenantId]);
    
    if (!pedido) {
      return res.status(404).json({ success: false, message: 'Pedido não encontrado' });
    }
    
    // ⚠️ VERIFICAR SE O STATUS REALMENTE MUDOU (evitar mensagens duplicadas)
    const statusAnterior = pedido.status;
    const statusMudou = statusAnterior !== status;
    
    console.log(`📊 Pedido #${pedido.numero_pedido || id}: ${statusAnterior} → ${status} (mudou: ${statusMudou})`);
    
    if (!statusMudou) {
      console.log('⚠️ Status não mudou, pulando atualização e notificação');
      return res.json({ success: true, whatsappEnviado: false, message: 'Status já está neste estado' });
    }
    
    // Atualizar status
    await dbRun(`
      UPDATE pedidos 
      SET status = ?, data_atualizacao = CURRENT_TIMESTAMP 
      WHERE id = ? AND tenant_id = ?
    `, [status, id, req.tenantId]);
    
    // Buscar configurações da empresa
    const tenant = await dbGet('SELECT * FROM tenants WHERE id = ?', [req.tenantId]);
    const config = tenant?.config_json ? JSON.parse(tenant.config_json) : {};
    const nomeEmpresa = config.companyName || tenant?.nome || 'Estabelecimento';
    
    // Enviar WhatsApp automático APENAS se o status mudou
    let whatsappEnviado = false;
    const clienteData = JSON.parse(pedido.cliente_json || '{}');
    const numeroCliente = clienteData.whatsapp;
    
    if (numeroCliente) {
      let mensagem = '';
      
      // Enviar mensagem apenas para transições específicas (evita spam)
      if (statusAnterior === 'pendente' && status === 'confirmado') {
        mensagem = `✅ *Pedido Confirmado!*\n\nOlá ${clienteData.nome}! 👋\n\nSeu pedido #${pedido.numero_pedido || id} foi *confirmado* e está sendo preparado! 🍞👨‍🍳\n\n*${nomeEmpresa}*`;
      } else if (statusAnterior === 'confirmado' && status === 'pronto') {
        // Status "pronto" para retirada
        mensagem = `✅ *Pedido Pronto para Retirada!*\n\nOlá ${clienteData.nome}! 👋\n\nSeu pedido #${pedido.numero_pedido || id} está *pronto*! 🎉\n\nVenha buscar quando puder.\n\n*${nomeEmpresa}*`;
      } else if (statusAnterior === 'pronto' && status === 'a_caminho') {
        // Status "a caminho" - pedido saiu para entrega
        mensagem = `🛵 *Pedido Saiu para Entrega!*\n\nOlá ${clienteData.nome}! 👋\n\nSeu pedido #${pedido.numero_pedido || id} está a caminho! 🚗💨\n\nEm breve chegará no seu endereço.\n\n*${nomeEmpresa}*`;
      } else if (statusAnterior === 'confirmado' && status === 'entregue' && pedido.tipo_entrega === 'delivery') {
        mensagem = `🚗 *Pedido Saiu para Entrega!*\n\nOlá ${clienteData.nome}! 👋\n\nSeu pedido #${pedido.numero_pedido || id} está a caminho! 🛵💨\n\nEm breve chegará no seu endereço.\n\n*${nomeEmpresa}*`;
      }
      
      if (mensagem) {
        console.log(`📱 Enviando WhatsApp para ${numeroCliente}...`);
        const resultWhatsapp = await enviarWhatsApp(numeroCliente, mensagem, req.tenantId);
        whatsappEnviado = resultWhatsapp.success;
        
        if (whatsappEnviado) {
          console.log('✅ WhatsApp enviado com sucesso');
        } else {
          console.log('❌ Falha ao enviar WhatsApp');
        }
      } else {
        console.log(`ℹ️ Nenhuma notificação configurada para transição ${statusAnterior} → ${status}`);
      }
    }
    
    res.json({ success: true, whatsappEnviado });
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar status' });
  }
});

// DADOS DO ESTABELECIMENTO
app.get('/api/company-data', async (req, res) => {
  try {
    const tenant = await dbGet('SELECT * FROM tenants WHERE id = ?', [req.tenantId]);
    const config = tenant?.config_json ? JSON.parse(tenant.config_json) : {};

    const companyData = {
      // Campos principais consumidos pelo front
      companyName: config.companyName || tenant?.nome || '',
      companyWhatsapp: config.companyWhatsapp || tenant?.whatsapp || tenant?.telefone || '',
      contactWhatsapp: config.contactWhatsapp || config.companyWhatsapp || tenant?.telefone || tenant?.whatsapp || '',
      locationLink: config.locationLink || tenant?.endereco || '',
      businessHoursSchedule: config.businessHoursSchedule || [],
      businessHours: config.businessHours || tenant?.horario_funcionamento || '',
      statusOverride: Object.prototype.hasOwnProperty.call(config, 'statusOverride') ? config.statusOverride : null,

      // Demais configs (entrega / pix)
      deliveryFeesByNeighborhood: config.deliveryFeesByNeighborhood || {},
      pixKey: config.pixKey || '',
      pixCodigo: config.pixCodigo || '',
      pixName: config.pixName || '',
      mpAccessToken: config.mpAccessToken || '',

      // Quaisquer extras ficam preservados
      ...config
    };

    res.json({
      success: true,
      companyData
    });
  } catch (error) {
    console.error('Erro ao buscar dados:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar dados' });
  }
});

app.put('/api/company-data', async (req, res) => {
  try {
    const { companyData = {} } = req.body || {};
    const tenant = await dbGet('SELECT * FROM tenants WHERE id = ?', [req.tenantId]);

    const {
      companyName,
      companyWhatsapp,
      contactWhatsapp,
      locationLink,
      businessHoursSchedule,
      businessHours,
      statusOverride,
      ...rest
    } = companyData;

    const configJson = JSON.stringify({
      companyName,
      companyWhatsapp,
      contactWhatsapp,
      locationLink,
      businessHoursSchedule,
      businessHours,
      statusOverride,
      ...rest
    } || {});

    await dbRun(`
      UPDATE tenants 
      SET nome = ?, telefone = ?, endereco = ?, whatsapp = ?, 
          horario_funcionamento = ?, config_json = ?
      WHERE id = ?
    `, [
      companyName || tenant?.nome,
      contactWhatsapp || companyWhatsapp || tenant?.telefone,
      locationLink || tenant?.endereco,
      companyWhatsapp || tenant?.whatsapp,
      businessHours || tenant?.horario_funcionamento,
      configJson,
      req.tenantId
    ]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar dados:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar dados' });
  }
});

app.post('/api/company-data', async (req, res) => {
  try {
    const { companyData = {} } = req.body || {};
    const tenant = await dbGet('SELECT * FROM tenants WHERE id = ?', [req.tenantId]);

    const {
      companyName,
      companyWhatsapp,
      contactWhatsapp,
      locationLink,
      businessHoursSchedule,
      businessHours,
      statusOverride,
      ...rest
    } = companyData;

    const configJson = JSON.stringify({
      companyName,
      companyWhatsapp,
      contactWhatsapp,
      locationLink,
      businessHoursSchedule,
      businessHours,
      statusOverride,
      ...rest
    } || {});

    await dbRun(`
      UPDATE tenants 
      SET nome = ?, telefone = ?, endereco = ?, whatsapp = ?, 
          horario_funcionamento = ?, config_json = ?
      WHERE id = ?
    `, [
      companyName || tenant?.nome,
      contactWhatsapp || companyWhatsapp || tenant?.telefone,
      locationLink || tenant?.endereco,
      companyWhatsapp || tenant?.whatsapp,
      businessHours || tenant?.horario_funcionamento,
      configJson,
      req.tenantId
    ]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao salvar dados:', error);
    res.status(500).json({ success: false, message: 'Erro ao salvar dados' });
  }
});

// CATEGORIAS CUSTOMIZADAS (salvas em config_json do tenant)
app.get('/api/custom-categories', async (req, res) => {
  try {
    const tenant = await dbGet('SELECT config_json FROM tenants WHERE id = ?', [req.tenantId]);
    const config = tenant?.config_json ? JSON.parse(tenant.config_json) : {};
    const categories = config.customCategories || [];
    res.json({ success: true, categories });
  } catch (error) {
    console.error('Erro ao buscar custom categories:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar categorias' });
  }
});

app.post('/api/custom-categories', async (req, res) => {
  try {
    const { categories } = req.body;
    const tenant = await dbGet('SELECT config_json FROM tenants WHERE id = ?', [req.tenantId]);
    const config = tenant?.config_json ? JSON.parse(tenant.config_json) : {};
    config.customCategories = categories || [];
    await dbRun('UPDATE tenants SET config_json = ? WHERE id = ?', [JSON.stringify(config), req.tenantId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao salvar custom categories:', error);
    res.status(500).json({ success: false, message: 'Erro ao salvar categorias' });
  }
});

// PROMOÇÕES
app.get('/api/promocoes', async (req, res) => {
  try {
    const promocoes = await dbAll(`
      SELECT * FROM promocoes 
      WHERE tenant_id = ? AND ativo = 1
      ORDER BY data_inicio DESC
    `, [req.tenantId]);
    res.json(promocoes);
  } catch (error) {
    console.error('Erro ao buscar promoções:', error);
    res.status(500).json({ erro: 'Erro ao buscar promoções' });
  }
});

// Compatibilidade com frontend legado
app.get('/api/promotions', async (req, res) => {
  try {
    const promocoes = await dbAll(`
      SELECT * FROM promocoes 
      WHERE tenant_id = ? AND ativo = 1
      ORDER BY data_inicio DESC
    `, [req.tenantId]);
    res.json(promocoes);
  } catch (error) {
    console.error('Erro ao buscar promoções (compat):', error);
    res.status(500).json({ erro: 'Erro ao buscar promoções' });
  }
});

app.get('/api/item-promotions', async (_req, res) => {
  // Ainda não há promoções por item implementadas
  res.json([]);
});

app.get('/api/categories-merged', async (req, res) => {
  try {
    const slugify = (str = '') => str.toString().toLowerCase().normalize('NFD').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');

    // Categorias padrão com emojis corretos
    const defaultCats = {
      'burguers': { key: 'burguers', nome: 'Burguers', emoji: '🍔' },
      'pizzas': { key: 'pizzas', nome: 'Pizzas', emoji: '🍕' },
      'porcoes': { key: 'porcoes', nome: 'Porções', emoji: '🍟' },
      'sobremesas': { key: 'sobremesas', nome: 'Sobremesas', emoji: '🍰' },
      'bebidas': { key: 'bebidas', nome: 'Bebidas', emoji: '🥤' }
    };

    const [categorias, produtos, tenant] = await Promise.all([
      dbAll(`
        SELECT * FROM categorias 
        WHERE tenant_id = ? AND ativo = 1 
        ORDER BY ordem, nome
      `, [req.tenantId]),
      dbAll(`
        SELECT * FROM produtos 
        WHERE tenant_id = ? AND disponivel = 1 
        ORDER BY ordem, nome
      `, [req.tenantId]),
      dbGet('SELECT config_json FROM tenants WHERE id = ?', [req.tenantId])
    ]);

    const config = tenant?.config_json ? JSON.parse(tenant.config_json) : {};
    const customCats = Array.isArray(config.customCategories) ? config.customCategories : [];

    // Inicia com categorias padrão
    const catMap = new Map(Object.entries(defaultCats));

    // Sobrescreve com categorias do banco
    categorias.forEach(cat => {
      const slug = slugify(cat.nome || 'outros') || 'outros';
      const existing = catMap.get(slug);
      catMap.set(slug, { 
        key: slug, 
        nome: cat.nome || 'Outros', 
        emoji: existing?.emoji || cat.emoji || '📦' 
      });
    });

    // Sobrescreve com customCategories (prioridade máxima)
    customCats.forEach(cat => {
      const slug = slugify(cat.key || cat.nome || 'outros') || 'outros';
      const nome = cat.nome || slug.replace(/-/g, ' ');
      const emoji = cat.emoji || cat.icon || '📦';
      catMap.set(slug, { key: slug, nome, emoji });
    });

    // Adiciona categorias inferidas dos produtos (se não existirem)
    produtos.forEach(p => {
      const cat = categorias.find(c => c.id === p.categoria_id);
      const slug = slugify(cat?.nome || 'outros') || 'outros';
      if (!catMap.has(slug)) {
        catMap.set(slug, { key: slug, nome: cat?.nome || 'Outros', emoji: '📦' });
      }
    });

    const categories = {};
    catMap.forEach((cat, slug) => {
      categories[slug] = cat;
    });

    res.json({ categories });
  } catch (error) {
    console.error('Erro ao buscar categorias (compat):', error);
    res.status(500).json({ erro: 'Erro ao buscar categorias' });
  }
});

app.get('/api/pedidos/:whatsapp', async (req, res) => {
  try {
    const whatsapp = (req.params.whatsapp || '').replace(/\D/g, '');
    const pedidos = await dbAll(`
      SELECT * FROM pedidos 
      WHERE tenant_id = ? AND REPLACE(REPLACE(REPLACE(REPLACE(cliente_telefone,'(',''),')',''),'-',''),' ','') LIKE ?
      ORDER BY data_pedido DESC
    `, [req.tenantId, `%${whatsapp}%`]);

    const pedidosFormatados = pedidos.map(p => ({
      ...p,
      itens: JSON.parse(p.itens)
    }));

    res.json(pedidosFormatados);
  } catch (error) {
    console.error('Erro ao buscar pedidos por WhatsApp (compat):', error);
    res.status(500).json({ erro: 'Erro ao buscar pedidos' });
  }
});

// LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { usuario, senha } = req.body;
    const senhaHash = require('crypto').createHash('md5').update(senha).digest('hex');
    
    const user = await dbGet(`
      SELECT u.*, t.slug, t.nome as nome_estabelecimento
      FROM usuarios u
      JOIN tenants t ON t.id = u.tenant_id
      WHERE u.email = ? AND u.senha = ? AND u.tenant_id = ? AND u.ativo = 1
    `, [usuario, senhaHash, req.tenantId]);
    
    if (user) {
      res.json({ 
        sucesso: true, 
        usuario: user.nome,
        slug: user.slug,
        estabelecimento: user.nome_estabelecimento
      });
    } else {
      res.status(401).json({ erro: 'Usuário ou senha inválidos' });
    }
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ erro: 'Erro no login' });
  }
});

// ========================================
// ROTAS SUPER ADMIN
// ========================================

const SUPER_ADMIN_TOKEN = 'super-admin-secret-token-2026'; // Mude isso!

function verificarSuperAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token === SUPER_ADMIN_TOKEN) {
    next();
  } else {
    res.status(401).json({ erro: 'Não autorizado' });
  }
}

// Login Super Admin
app.post('/api/super-admin/login', async (req, res) => {
  const { usuario, senha } = req.body;
  
  // Credenciais hardcoded (você pode melhorar isso)
  if (usuario === 'superadmin' && senha === 'admin@2026') {
    res.json({ 
      sucesso: true, 
      token: SUPER_ADMIN_TOKEN,
      nome: 'Super Administrador'
    });
  } else {
    res.status(401).json({ erro: 'Credenciais inválidas' });
  }
});

// Listar todos os tenants (com mais detalhes)
app.get('/api/super-admin/tenants', verificarSuperAdmin, async (req, res) => {
  try {
    const tenants = await dbAll('SELECT * FROM tenants ORDER BY data_cadastro DESC');
    res.json(tenants);
  } catch (error) {
    console.error('Erro ao listar tenants:', error);
    res.status(500).json({ erro: 'Erro ao listar estabelecimentos' });
  }
});

// Atualizar tenant
app.put('/api/super-admin/tenants/:id', verificarSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, slug, email, telefone, plano, ativo } = req.body;
    
    await dbRun(`
      UPDATE tenants 
      SET nome = ?, slug = ?, email = ?, telefone = ?, plano = ?, ativo = ?
      WHERE id = ?
    `, [nome, slug, email, telefone, plano, ativo, id]);
    
    res.json({ sucesso: true });
  } catch (error) {
    console.error('Erro ao atualizar tenant:', error);
    res.status(500).json({ erro: 'Erro ao atualizar' });
  }
});

// Toggle status do tenant
app.put('/api/super-admin/tenants/:id/toggle', verificarSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    await dbRun('UPDATE tenants SET ativo = NOT ativo WHERE id = ?', [id]);
    
    res.json({ sucesso: true });
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({ erro: 'Erro ao atualizar status' });
  }
});

// Deletar tenant (cuidado!)
app.delete('/api/super-admin/tenants/:id', verificarSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun('DELETE FROM tenants WHERE id = ?', [id]);
    res.json({ sucesso: true });
  } catch (error) {
    console.error('Erro ao deletar tenant:', error);
    res.status(500).json({ erro: 'Erro ao deletar' });
  }
});

// Estatísticas gerais
app.get('/api/super-admin/stats', verificarSuperAdmin, async (req, res) => {
  try {
    const total = await dbGet('SELECT COUNT(*) as total FROM tenants');
    const ativos = await dbGet('SELECT COUNT(*) as total FROM tenants WHERE ativo = 1');
    const produtos = await dbGet('SELECT COUNT(*) as total FROM produtos');
    const pedidos = await dbGet('SELECT COUNT(*) as total FROM pedidos');
    
    res.json({
      total_tenants: total.total,
      tenants_ativos: ativos.total,
      total_produtos: produtos.total,
      total_pedidos: pedidos.total
    });
  } catch (error) {
    console.error('Erro ao buscar stats:', error);
    res.status(500).json({ erro: 'Erro ao buscar estatísticas' });
  }
});

// MOCK - Mercado Pago PIX (para testes sem token real)
app.post('/api/mp-pix-create', async (req, res) => {
  try {
    const { amount, description, orderId } = req.body;
    const tenant = await dbGet('SELECT config_json FROM tenants WHERE id = ?', [req.tenantId]);
    const config = tenant?.config_json ? JSON.parse(tenant.config_json) : {};
    
    // Se houver token real (começa com TEST- ou APP_USR-), em produção faria chamada real
    // Para mock, sempre retorna dados fake realistas
    const mockPaymentId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const mockQrCode = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='; // pixel branco fake
    const mockCopiaECola = `00020126580014br.gov.bcb.brcode0136${Math.random().toString().substr(2, 12)}52040000530398654061${(amount || 0).toFixed(2).replace('.', '')}5303986540610512MOCK-PIX-TEST62500${orderId || 'TEST'}63041D3D`;
    
    // Salvar referência do pagamento no localStorage do cliente (será usado para webhook mock)
    res.json({
      success: true,
      paymentId: mockPaymentId,
      qrCode: mockQrCode,
      copiaECola: mockCopiaECola,
      amount: amount,
      description: description,
      status: 'pending',
      message: '(MOCK) Teste com QR code fake. Em produção, chamar API real do MP.'
    });
  } catch (error) {
    console.error('Erro ao criar PIX mock:', error);
    res.status(500).json({ success: false, message: 'Erro ao criar PIX' });
  }
});

// MOCK - Webhook Mercado Pago (simula confirmação de pagamento)
app.post('/api/mp-webhook', async (req, res) => {
  try {
    const { paymentId, orderId } = req.body;
    
    // Em produção, validaria assinatura do webhook
    // Para mock, apenas marca o pedido como "pago"
    await dbRun(`
      UPDATE pedidos 
      SET status = 'confirmado', mp_payment_id = ?
      WHERE id = ? AND tenant_id = ?
    `, [paymentId, orderId, req.tenantId]);
    
    res.json({ success: true, message: '(MOCK) Pagamento confirmado' });
  } catch (error) {
    console.error('Erro no webhook mock:', error);
    res.status(500).json({ success: false, message: 'Erro no webhook' });
  }
});

// ============ API WHATSAPP ============

// Função para enviar mensagem via WhatsApp (compatível com Evolution API, WhatsApp Business API, etc)
async function enviarWhatsApp(numero, mensagem, tenantId) {
  try {
    // Buscar configurações de WhatsApp do tenant
    const config = await dbGet(`
      SELECT whatsapp_api_url, whatsapp_api_key, whatsapp_instance 
      FROM company_data 
      WHERE tenant_id = ?
    `, [tenantId]);
    
    if (!config || !config.whatsapp_api_url || !config.whatsapp_api_key) {
      console.log('⚠️ Configurações de WhatsApp não encontradas para tenant:', tenantId);
      return { success: false, message: 'WhatsApp API não configurada' };
    }
    
    // Limpar número (remover caracteres especiais)
    const numeroLimpo = numero.replace(/\D/g, '');
    
    // Formato da mensagem para Evolution API (pode ser adaptado para outras APIs)
    const payload = {
      number: `55${numeroLimpo}@s.whatsapp.net`, // Formato Evolution API
      text: mensagem
    };
    
    console.log(`📱 Enviando WhatsApp para ${numeroLimpo}...`);
    
    const response = await fetch(`${config.whatsapp_api_url}/message/sendText/${config.whatsapp_instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.whatsapp_api_key
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ WhatsApp enviado com sucesso');
      return { success: true, data: result };
    } else {
      console.error('❌ Erro ao enviar WhatsApp:', result);
      return { success: false, message: result.message || 'Erro ao enviar' };
    }
  } catch (error) {
    console.error('❌ Erro na função enviarWhatsApp:', error);
    return { success: false, message: error.message };
  }
}

// Endpoint para enviar WhatsApp manualmente (teste)
app.post('/api/whatsapp/send', identificarTenant, async (req, res) => {
  try {
    const { numero, mensagem } = req.body;
    
    if (!numero || !mensagem) {
      return res.status(400).json({ success: false, message: 'Número e mensagem são obrigatórios' });
    }
    
    const result = await enviarWhatsApp(numero, mensagem, req.tenantId);
    res.json(result);
  } catch (error) {
    console.error('Erro ao enviar WhatsApp:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Inicializar servidor
inicializarUploadsDir().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor Multi-Tenant rodando na porta ${PORT}`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`🔐 Landing Page: http://localhost:${PORT}/landing.html`);
    console.log(`👑 Super Admin: http://localhost:${PORT}/super-admin.html`);
  });
});
