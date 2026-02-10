const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 3001;

// Configurar multer para upload de imagens
const uploadsDir = path.join(__dirname, 'uploads');

// Criar diretório de uploads se não existir
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
app.use(express.static('.')); // Servir arquivos estáticos
app.use('/uploads', express.static(uploadsDir)); // Servir uploads

// Rota para favicon (evitar erro 404)
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Arquivo para armazenar pedidos
const PEDIDOS_FILE = path.join(__dirname, 'pedidos.json');
const CARDAPIO_FILE = path.join(__dirname, 'cardapio.json');
const COMPANY_FILE = path.join(__dirname, 'company-data.json');
const PROMOTIONS_FILE = path.join(__dirname, 'promotions.json');
const CUSTOM_CATEGORIES_FILE = path.join(__dirname, 'custom-categories.json');

// Inicializar arquivo de pedidos se não existir
async function inicializarArquivoPedidos() {
  try {
    await fs.access(PEDIDOS_FILE);
  } catch {
    await fs.writeFile(PEDIDOS_FILE, JSON.stringify([], null, 2));
  }
}

// Inicializar arquivo de dados da empresa se não existir
async function inicializarArquivoEmpresa() {
  try {
    await fs.access(COMPANY_FILE);
  } catch {
    await fs.writeFile(COMPANY_FILE, JSON.stringify({}, null, 2));
  }
}

// Inicializar arquivo de promoções se não existir
async function inicializarArquivoPromotions() {
  try {
    await fs.access(PROMOTIONS_FILE);
  } catch {
    await fs.writeFile(PROMOTIONS_FILE, JSON.stringify([], null, 2));
  }
}

// Inicializar arquivo de promoções por item se não existir
async function inicializarArquivoItemPromotions() {
  try {
    await fs.access(ITEM_PROMOTIONS_FILE);
  } catch {
    await fs.writeFile(ITEM_PROMOTIONS_FILE, JSON.stringify([], null, 2));
  }
}

// Inicializar arquivo de categorias customizadas se não existir
async function inicializarArquivoCategorias() {
  try {
    await fs.access(CUSTOM_CATEGORIES_FILE);
  } catch {
    await fs.writeFile(CUSTOM_CATEGORIES_FILE, JSON.stringify([], null, 2));
  }
}

// Ler cardápio
async function lerCardapio() {
  try {
    const data = await fs.readFile(CARDAPIO_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log('Cardápio não encontrado, será criado na primeira edição');
    return null;
  }
}

// Salvar cardápio
async function salvarCardapio(cardapio) {
  try {
    await fs.writeFile(CARDAPIO_FILE, JSON.stringify(cardapio, null, 2));
  } catch (error) {
    console.error('Erro ao salvar cardápio:', error);
  }
}

// Ler promoções
async function lerPromotions() {
  try {
    const data = await fs.readFile(PROMOTIONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log('Promoções não encontradas, será criada na primeira edição');
    return [];
  }
}

// Salvar promoções
async function salvarPromotions(promotions) {
  try {
    await fs.writeFile(PROMOTIONS_FILE, JSON.stringify(promotions, null, 2));
  } catch (error) {
    console.error('Erro ao salvar promoções:', error);
  }
}

// Ler dados da empresa
async function lerCompanyData() {
  try {
    const data = await fs.readFile(COMPANY_FILE, 'utf8');
    return JSON.parse(data || '{}');
  } catch (error) {
    console.error('Erro ao ler dados da empresa:', error);
    return {};
  }
}

// Salvar dados da empresa
async function salvarCompanyData(companyData) {
  try {
    await fs.writeFile(COMPANY_FILE, JSON.stringify(companyData || {}, null, 2));
  } catch (error) {
    console.error('Erro ao salvar dados da empresa:', error);
    throw error;
  }
}

// Ler pedidos
async function lerPedidos() {
  try {
    const data = await fs.readFile(PEDIDOS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao ler pedidos:', error);
    return [];
  }
}

// Salvar pedidos
async function salvarPedidos(pedidos) {
  try {
    await fs.writeFile(PEDIDOS_FILE, JSON.stringify(pedidos, null, 2));
  } catch (error) {
    console.error('Erro ao salvar pedidos:', error);
  }
}

// Normaliza números de WhatsApp para comparação (remove caracteres não numéricos)
const normalizarWhatsapp = (valor = '') => (valor || '').replace(/\D/g, '');

// Credenciais de admin (você pode mudar isso)
const ADMIN_USUARIO = 'admin';
const ADMIN_SENHA = 'admin123';

// Rota de login
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

// Horários de funcionamento (mesmo do front)
const horarios = {
  0: { nome: 'Domingo', abertura: '18:30', fechamento: '23:00' },
  1: { nome: 'Segunda', abertura: '18:30', fechamento: '23:00' },
  2: { nome: 'Terça', abertura: '18:30', fechamento: '23:00' },
  3: { nome: 'Quarta', abertura: null, fechamento: null, fechado: true },
  4: { nome: 'Quinta', abertura: '18:30', fechamento: '23:00' },
  5: { nome: 'Sexta', abertura: '18:30', fechamento: '23:00' },
  6: { nome: 'Sábado', abertura: '18:30', fechamento: '23:00' }
};

// Verifica se já passou do horário de fechamento (oculta para cliente)
function expedienteFechado(agora = new Date()) {
  const dia = agora.getDay();
  const horarioDia = horarios[dia];
  if (!horarioDia || horarioDia.fechado) return true;

  const [fechHora, fechMin] = horarioDia.fechamento.split(':').map(Number);
  const horaAtual = agora.getHours() + agora.getMinutes() / 60;
  const horaFechamento = fechHora + fechMin / 60;
  return horaAtual > horaFechamento;
}

// Rota para criar novo pedido
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

// Rota para listar pedidos de um cliente (por WhatsApp)
app.get('/api/pedidos/:whatsapp', async (req, res) => {
  try {
    const { whatsapp } = req.params;
    const whatsappNormalizado = normalizarWhatsapp(whatsapp);
    const pedidos = await lerPedidos();
    const agora = new Date();

    // Se passou do horário de fechamento, não mostrar nada para o cliente, mas manter salvo
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

// Rota para listar todos os pedidos (admin)
app.get('/api/pedidos', async (req, res) => {
  try {
    const todosPedidos = await lerPedidos();
    
    // Pega a data de hoje no formato YYYY-MM-DD (local)
    const hoje = new Date();
    const anoHoje = hoje.getFullYear();
    const mesHoje = String(hoje.getMonth() + 1).padStart(2, '0');
    const diaHoje = String(hoje.getDate()).padStart(2, '0');
    const hojeISO = `${anoHoje}-${mesHoje}-${diaHoje}`;
    
    const pedidosHoje = todosPedidos.filter(p => {
      // Extrai a data no formato YYYY-MM-DD da data ISO
      const dataPedidoISO = p.data.split('T')[0];
      return dataPedidoISO === hojeISO;
    });
    
    res.json({ 
      success: true, 
      pedidos: pedidosHoje 
    });
  } catch (error) {
    console.error('Erro ao buscar pedidos:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar pedidos.' 
    });
  }
});

// Rota para atualizar status do pedido
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

// Rota para obter cardápio (para sincronizar no site)
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

// Rota para salvar cardápio (atualizado do painel admin)
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

  // Rota para obter promoções
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

  // Rota para salvar promoções (atualizado do painel admin)
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



  // Rota para salvar promoções (atualizado do painel admin)
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

// Rota para obter dados da empresa
app.get('/api/company-data', async (req, res) => {
  try {
    const companyData = await lerCompanyData();
    res.json({ success: true, companyData });
  } catch (error) {
    console.error('Erro ao buscar dados da empresa:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar dados da empresa.' });
  }
});

// Rota para salvar dados da empresa
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

// Rota para upload de imagens
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

// Rotas de categorias customizadas
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

// Rota para obter categorias mescladas (padrão + custom)
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

    // Mesclar: começar com padrão e aplicar overrides
    const merged = { ...categoriasPadrao };
    customCategories.forEach(cat => {
      if (merged[cat.key]) {
        // Override de padrão
        merged[cat.key] = { ...merged[cat.key], emoji: cat.emoji || merged[cat.key].emoji, nome: cat.nome };
      } else {
        // Nova categoria
        merged[cat.key] = { emoji: cat.emoji || '📦', nome: cat.nome, icon: 'fa-box' };
      }
    });

    res.json({ success: true, categories: merged });
  } catch (error) {
    console.error('Erro ao mesclar categorias:', error);
    res.status(500).json({ success: false, message: 'Erro ao obter categorias' });
  }
});

// Funções para promoções por item
const ITEM_PROMOTIONS_FILE = path.join(__dirname, 'item-promotions.json');

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

// GET promoções por item
app.get('/api/item-promotions', async (req, res) => {
  try {
    const promotions = await lerItemPromotions();
    res.json({ success: true, promotions });
  } catch (error) {
    console.error('Erro ao buscar promoções:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar promoções' });
  }
});

// POST promoção para um item específico
app.post('/api/item-promotions', async (req, res) => {
  try {
    const { itemName, discount, description, ativo } = req.body;

    if (!itemName || discount === undefined) {
      return res.status(400).json({ success: false, message: 'Dados inválidos' });
    }

    const promotions = await lerItemPromotions();
    
    // Verificar se já existe promoção para este item
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

// DELETE promoção
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

app.listen(PORT, async () => {
  await inicializarArquivoPedidos();
  await inicializarArquivoEmpresa();
  await inicializarArquivoPromotions();
  await inicializarArquivoItemPromotions();
  await inicializarArquivoCategorias();
  await inicializarUploadsDir();
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});

