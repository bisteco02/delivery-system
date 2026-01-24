console.log('🚀 Painel Admin carregado - Versão 1.1');

let pedidos = [];
let filtroAtivo = 'todos';
let filtroPagamento = 'todos';
let filtroTipo = 'todos';
let searchTerm = '';
let autoRefreshInterval = null;
let somAtivo = false;
let autoConfirmar = false; // Controla se auto confirmação está ativa
let ultimoPedidoIds = new Set();
let primeiraVez = true;

// Preferências do admin (auto-refresh e som)
let adminPrefs = (() => {
    try { return JSON.parse(localStorage.getItem('adminPrefs') || '{}'); } catch { return {}; }
})();

// Inicializar estado de som a partir das preferências
somAtivo = !!adminPrefs.somAtivo;
autoConfirmar = !!adminPrefs.autoConfirmar;

// Tenant helpers
const TENANT = (() => {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    let slug = 'padoca-do-dede'; // Default correto
    
    console.log('🔍 Detectando tenant - pathname:', window.location.pathname);
    console.log('🔍 PathParts:', pathParts);
    
    if (pathParts.length > 0 && !pathParts[0].includes('.')) {
        slug = pathParts[0];
        console.log('🔍 Slug do path:', slug);
        // Normalizar variações do slug
        if (slug === 'padoca-dede') {
            slug = 'padoca-do-dede';
            console.log('🔄 Slug normalizado para:', slug);
        }
    }
    
    const searchParams = new URLSearchParams(window.location.search);
    const finalTenant = searchParams.get('tenant') || slug;
    console.log('🏪 Tenant final:', finalTenant);
    return finalTenant;
})();
const API_BASE = `${window.location.origin}/api`;
const tenantHeaders = { 'x-tenant': TENANT };
console.log('🏪 Tenant detectado:', TENANT);
console.log('📡 API Base:', API_BASE);
console.log('📋 Headers do tenant:', tenantHeaders);
const fetchTenant = (path, options = {}) => fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...(options.headers || {}), ...tenantHeaders }
});

// ⚡ RESTAURAR ABA ATIVA IMEDIATAMENTE (antes de qualquer renderização)
// Isso evita o "flash" visual de mudança de aba
(() => {
    const abaSalva = localStorage.getItem('abaPainelAtiva');
    if (abaSalva && document.getElementById(abaSalva)) {
        // Mostrar apenas a aba salva, ocultar as outras
        document.querySelectorAll('.tab-section').forEach(sec => {
            if (sec.id === abaSalva) {
                sec.classList.remove('hidden');
            } else {
                sec.classList.add('hidden');
            }
        });
        // Atualizar botões de aba
        document.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn.dataset.tab === abaSalva) {
                btn.classList.add('active', 'bg-zinc-900', 'text-white');
            } else {
                btn.classList.remove('active', 'bg-zinc-900', 'text-white');
            }
        });
        
        // Atualizar título do header (será definido depois, quando tabTitles estiver disponível)
        // Temporariamente, aguarde um pouco
        setTimeout(() => {
            const tabTitlesTemp = {
                'tab-dashboard': '📦 Painel Admin - Início',
                'tab-pedidos': '📋 Painel Admin - Ver pedidos',
                'tab-itens': '🍔 Painel Admin - Meus itens',
                'tab-categorias': '� Painel Admin - Categorias',
                'tab-pagamentos': '💳 Painel Admin - Formas de pagamento',
                'tab-config': '⚙️ Painel Admin - Configurações',
                'tab-promotions': '🎉 Painel Admin - Promoções',
                'tab-relatorios': '📊 Painel Admin - Relatórios',
                'tab-senha': '🔐 Painel Admin - Alterar senha',
                'tab-whatsapp': '💬 Painel Admin - Conectar WhatsApp'
            };
            if (tabTitlesTemp[abaSalva]) {
                document.getElementById('header-title').textContent = tabTitlesTemp[abaSalva];
            }
        }, 0);
        
        console.log('⚡ Aba restaurada imediatamente (sem flash):', abaSalva);
    }
})();

function ajustarLinksTenant() {
    const back = document.getElementById('back-to-site');
    if (back) back.href = `/${TENANT}/index.html`;
}

// Funções do Modal de Confirmação de Filtro
function abrirModalFiltro(tipo, dados) {
    const modal = document.getElementById('modal-filtro-confirmacao');
    const header = document.getElementById('modal-filtro-header');
    const icon = document.getElementById('modal-filtro-icon');
    const titulo = document.getElementById('modal-filtro-titulo');
    
    if (tipo === 'limpar') {
        header.className = 'bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white';
        icon.className = 'fa fa-check-circle text-3xl';
        titulo.textContent = 'Filtro Removido';
    } else if (tipo === 'filtrar') {
        header.className = 'bg-gradient-to-r from-green-600 to-green-700 p-6 text-white';
        icon.className = 'fa fa-filter text-3xl';
        titulo.textContent = 'Filtro Aplicado';
    }
    
    document.getElementById('modal-filtro-total-pedidos').textContent = dados.totalPedidos;
    document.getElementById('modal-filtro-faturamento').textContent = `R$ ${dados.faturamento.toFixed(2).replace('.', ',')}`;
    
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.remove('hidden'), 10);
}

function fecharModalFiltro() {
    const modal = document.getElementById('modal-filtro-confirmacao');
    modal.classList.add('hidden');
    setTimeout(() => modal.style.display = 'none', 300);
}

// Fechar modal ao clicar fora
document.addEventListener('click', (e) => {
    const modal = document.getElementById('modal-filtro-confirmacao');
    if (modal && e.target === modal) {
        fecharModalFiltro();
    }
});

// Modal Genérico de Notificação
function mostrarModal(tipo, titulo, mensagem) {
    const modal = document.getElementById('modal-notificacao');
    const header = document.getElementById('modal-notif-header');
    const icon = document.getElementById('modal-notif-icon');
    const tituloEl = document.getElementById('modal-notif-titulo');
    const mensagemEl = document.getElementById('modal-notif-mensagem');
    const btn = document.getElementById('modal-notif-btn');
    
    // Configurar estilo baseado no tipo
    if (tipo === 'sucesso') {
        header.className = 'bg-gradient-to-r from-green-600 to-green-700 p-6 text-white';
        icon.className = 'fa fa-check-circle text-3xl';
        btn.className = 'px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition';
    } else if (tipo === 'erro') {
        header.className = 'bg-gradient-to-r from-red-600 to-red-700 p-6 text-white';
        icon.className = 'fa fa-exclamation-circle text-3xl';
        btn.className = 'px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition';
    } else if (tipo === 'aviso') {
        header.className = 'bg-gradient-to-r from-yellow-500 to-yellow-600 p-6 text-white';
        icon.className = 'fa fa-exclamation-triangle text-3xl';
        btn.className = 'px-6 py-2 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 transition';
    } else {
        header.className = 'bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white';
        icon.className = 'fa fa-info-circle text-3xl';
        btn.className = 'px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition';
    }
    
    tituloEl.textContent = titulo;
    mensagemEl.textContent = mensagem;
    btn.textContent = 'OK';
    btn.onclick = fecharModalNotificacao;
    
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.remove('hidden'), 10);
}

function fecharModalNotificacao() {
    const modal = document.getElementById('modal-notificacao');
    modal.classList.add('hidden');
    setTimeout(() => modal.style.display = 'none', 300);
}

// Fechar modal ao clicar fora
document.addEventListener('click', (e) => {
    const modal = document.getElementById('modal-notificacao');
    if (modal && e.target === modal) {
        fecharModalNotificacao();
    }
});

// Auto-refresh helpers
function iniciarAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    console.log('🔄 Auto-refresh ATIVADO (intervalo: 8s)');
    autoRefreshInterval = setInterval(() => {
        const tab = document.getElementById('tab-pedidos');
        const visivel = tab && !tab.classList.contains('hidden');
        if (visivel) {
            console.log('🔄 Auto-refresh executando...');
            carregarPedidos();
        }
    }, 8000); // 8s: responsivo sem sobrecarregar
}

function pararAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        console.log('⏹️ Auto-refresh DESATIVADO');
    }
}

// Variáveis globais do modal de edição
let editingItemIndex = null;
let editingPromotionIndex = null;
let confirmationCallback = null;
let promotionMode = 'manual'; // 'manual' ou 'combo'
let selectedComboItems = []; // itens selecionados para combo
let comboFilterCategory = 'todos'; // categoria filtrada
let customCategories = []; // categorias customizadas pelo usuário


// Cardápio completo (mesmos dados do index.html)
let promotions = [];

let menu = [
    // Burguers
    {name: "CORINGA", category: "burguers", price: 33.00, image: "./assets/Coringa.jpg", description: "Pão de abóbora, 2x burger 150g, 2x queijo mussarela, 2x bacon, 2x cebola caramelizada, molho especial, maionese.", ativo: true},
    {name: "DARTH VADER", category: "burguers", price: 33.00, image: "./assets/darthvader.jpg", description: "Pão de abóbora, 2x burger 150g, 2x cheddar, 2x bacon, 2x cebola caramelizada, molho barbecue, maionese.", ativo: true},
    {name: "GARGAMEL", category: "burguers", price: 24.00, image: "./assets/Gargamel.jpg", description: "Pão americano, maionese, burger 150g, mussarela, bacon, cebola caramelizada, maionese, molho especial.", ativo: true},
    {name: "LEX LUTHOR", category: "burguers", price: 24.00, image: "./assets/Lex Luthor.jpg", description: "Pão americano, barbecue, burger 150g, cheddar, bacon, cebola caramelizada, maionese.", ativo: true},
    {name: "MUN-RÁ", category: "burguers", price: 26.00, image: "./assets/mun-ra.png", description: "Pão americano, molho especial, maionese, burger 150g, queijo mussarela, bacon, cebola caramelizada, tomate, alface, cebola roxa.", ativo: true},
    {name: "RAINHA DE COPAS", category: "burguers", price: 22.00, image: "./assets/rainha-de-copas.png", description: "Pão americano, molho especial, maionese, burger 150g, queijo mussarela, tomate, alface americana, cebola roxa e maionese.", ativo: true},
    {name: "DE LA CRUZ", category: "burguers", price: 35.00, image: "./assets/delacruz.png", description: "Pão australiano, 2x carne 150g, 2x queijo mussarela, 2x bacon, 2x cebola caramelizada, molho especial, maionese, tomate, alface e cebola roxa.", ativo: true},
    {name: "THANOS", category: "burguers", price: 35.00, image: "./assets/thanos.png", description: "Pão australiano, 2x burger de porco, 2x bacon, 2x mussarela na chapa, 2x cheddar, cebola crispy e molho barbecue.", ativo: true},
    {name: "JUGGERNAULT", category: "burguers", price: 31.00, image: "./assets/juggernault.png", description: "Pão americano, 2x burger 150g, 2x cheddar, cebola crispy, tomate, alface, ketchup e maionese.", ativo: true},
    {name: "MADARA", category: "burguers", price: 26.00, image: "./assets/madara.png", description: "Pão australiano, carne de porco 150g, bacon, queijo mussarela na chapa, cheddar, cebola crispy e molho barbecue.", ativo: true},
    {name: "ROBOTNIK", category: "burguers", price: 33.00, image: "./assets/robotnik.png", description: "Pão americano, burger 150g, requeijão, frango com ervas, cebola roxa, tomate e ketchup.", ativo: true},
    {name: "Roger Klotz", category: "burguers", price: 22.00, image: "./assets/roger clotz.png", description: "Pão americano, ketchup, maionese, cheddar, alface, tomate e carne bovina 150g.", ativo: true},
    {name: "EXTERMINADOR - T800", category: "burguers", price: 36.00, image: "./assets/exterminador.png", description: "Pão australiano, 3x burger 150g, 3x cheddar e cebola roxa.", ativo: true},
    {name: "Caruso", category: "burguers", price: 25.00, image: "./assets/caruso.png", description: "Pão de sementes, burger, chimichurri, 2x mussarela na chapa, tomate, cebola roxa, maionese e ketchup.", ativo: true},
    
    // Pizzas
    {name: "MIRANDA PRIESTLY (Margherita) - 8 pedaços", category: "pizzas", price: 45.00, image: "./assets/Margherita.png", description: "Massa de longa fermentação, molho de tomate, mussarela, parmesão e tomate.", ativo: true},
    {name: "NAZARÉ TEDESCO (Calabresa) - 8 pedaços", category: "pizzas", price: 48.00, image: "./assets/Calabresa.png", description: "Massa de longa fermentação, molho de tomate, calabresa, mussarela e parmesão.", ativo: true},
    {name: "DANAERYS TARGERIAN (Frango com requeijão) - 8 pedaços", category: "pizzas", price: 50.00, image: "./assets/Frango e Catupiry.jpg", description: "Massa de longa fermentação, molho de tomate, mussarela, frango e requeijão.", ativo: true},
    {name: "CRUELLA (3 queijos) - 8 pedaços", category: "pizzas", price: 50.00, image: "./assets/3 queijos.png", description: "Massa de longa fermentação, molho de tomate, mussarela, requeijão e parmesão.", ativo: true},
    {name: "AGATHA TRUNCHBULL (Autoral) - 8 pedaços", category: "pizzas", price: 60.00, image: "./assets/agatha.png", description: "Massa de longa fermentação, molho de tomate, mussarela, parmesão, calabresa, carne de sol e requeijão cremoso.", ativo: true},
    {name: "PAOLLA BRACHO (Portuguesa) - 8 pedaços", category: "pizzas", price: 55.00, image: "./assets/portuguesa.png", description: "Massa de longa fermentação, molho de tomate, mussarela, parmesão, bacon, requeijão, cebola roxa, tomate e orégano.", ativo: true},
    {name: "MIRANDA PRIESTLY (Margherita) - 4 pedaços", category: "pizzas", price: 25.00, image: "./assets/Margherita.png", description: "Massa de longa fermentação, molho de tomate, mussarela, parmesão e tomate.", ativo: true},
    {name: "NAZARÉ TEDESCO (Calabresa) - 4 pedaços", category: "pizzas", price: 28.00, image: "./assets/Calabresa.png", description: "Massa de longa fermentação, molho de tomate, calabresa, mussarela e parmesão.", ativo: true},
    {name: "DANAERYS TARGERIAN (Frango com requeijão) - 4 pedaços", category: "pizzas", price: 28.00, image: "./assets/Frango e Catupiry.jpg", description: "Massa de longa fermentação, molho de tomate, mussarela, frango e requeijão.", ativo: true},
    {name: "CRUELLA (3 queijos) - 4 pedaços", category: "pizzas", price: 30.00, image: "./assets/3 queijos.png", description: "Massa de longa fermentação, molho de tomate, mussarela, requeijão e parmesão.", ativo: true},
    {name: "AGATHA TRUNCHBULL (Autoral) - 4 pedaços", category: "pizzas", price: 32.00, image: "./assets/agatha.png", description: "Massa de longa fermentação, molho de tomate, mussarela, parmesão, calabresa, carne de sol e requeijão cremoso.", ativo: true},
    {name: "PAOLLA BRACHO (Portuguesa) - 4 pedaços", category: "pizzas", price: 30.00, image: "./assets/portuguesa.png", description: "Massa de longa fermentação, molho de tomate, mussarela, parmesão, bacon, requeijão, cebola roxa, tomate e orégano.", ativo: true},
    
    // Porções
    {name: "Batata Tradicional", category: "porcoes", price: 20.00, image: "./assets/batata tradicional.png", description: "450g (Temperada com sal)", ativo: true},
    {name: "Batata Red Smoked", category: "porcoes", price: 20.00, image: "./assets/batata red smoked.png", description: "450g (com tempero especial)", ativo: true},
    {name: "Onion Rings", category: "porcoes", price: 22.00, image: "./assets/onion rings.png", description: "300g", ativo: true},
    {name: "Batata Rústica", category: "porcoes", price: 22.00, image: "./assets/batata rustica.png", description: "350g", ativo: true},
    {name: "Bolinho de Carne de Sol com Requeijão", category: "porcoes", price: 22.00, image: "./assets/bolinho de carne de sol.png", description: "6 bolinho de 45g", ativo: true},
    {name: "Batata Garlic & Onion", category: "porcoes", price: 20.00, image: "./assets/batata garlic e onion.png", description: "450g (com tempero especial)", ativo: true},
    
    // Sobremesas
    {name: "Bolo de pote - Ninho trufado", category: "sobremesas", price: 18.00, image: "./assets/bolo de pote ninho trufaod.png", description: "Bolo delicioso de leite ninho com chocolate meio amargo.", ativo: true},
    {name: "Bolo de pote - Abacaxi aos 4 leites", category: "sobremesas", price: 16.00, image: "./assets/bolo de pote abacaxi.png", description: "Pão de ló, abacaxi, leite condensado, creme de leite, leite em pó e leite de coco.", ativo: true},
    
    // Bebidas
    {name: "Coca Cola Zero Lata", category: "bebidas", price: 6.00, image: "./assets/Coca Zero Lata.png", description: "", ativo: true},
    {name: "Coca Cola 2L", category: "bebidas", price: 12.00, image: "./assets/Coca 2L.jpg", description: "", ativo: true},
    {name: "Coca Cola Lata", category: "bebidas", price: 5.00, image: "./assets/Coca Lata.jpg", description: "", ativo: true},
    {name: "Coca Cola Zero 2L", category: "bebidas", price: 15.00, image: "./assets/Coca Zero 2L.png", description: "", ativo: true},
    {name: "Guaraná Antártica Lata", category: "bebidas", price: 5.00, image: "./assets/Guarana Lata.jpg", description: "", ativo: true}
];

// Som de notificação (usar caminho absoluto para evitar problemas com rotas tenant)
const audioNovo = new Audio(`/${TENANT}/assets/fart-with-reverb.mp3`);
console.log('🔊 Áudio configurado:', audioNovo.src);

const tabTitles = {
    'tab-dashboard': '📦 Painel Admin - Início',
    'tab-pedidos': '📋 Painel Admin - Ver pedidos',
    'tab-itens': '🍔 Painel Admin - Meus itens',
    'tab-categorias': '📚 Painel Admin - Categorias',
    'tab-pagamentos': '💳 Painel Admin - Formas de pagamento',
    'tab-config': '⚙️ Painel Admin - Configurações',
    'tab-promotions': '🎉 Painel Admin - Promoções',
    'tab-relatorios': '📊 Painel Admin - Relatórios'
};
function setTab(tabId) {
    console.log(`🔄 Tentando abrir aba: ${tabId}`);
    document.querySelectorAll('.tab-section').forEach(sec => sec.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active', 'bg-zinc-900', 'text-white'));
    const target = document.getElementById(tabId);
    console.log(`✅ Elemento encontrado:`, target);
    if (target) target.classList.remove('hidden');
    const tabBtn = document.querySelector(`[data-tab="${tabId}"]`);
    if (tabBtn) tabBtn.classList.add('active', 'bg-zinc-900', 'text-white');
    if (tabTitles[tabId]) {
        document.getElementById('header-title').textContent = tabTitles[tabId];
    }
    
    // Salvar aba ativa no localStorage para persistência
    localStorage.setItem('abaPainelAtiva', tabId);
    
    // Carregar pedidos ao abrir a aba "Ver pedidos"
    if (tabId === 'tab-pedidos') {
        console.log('📋 Aba Ver pedidos aberta - carregando pedidos');
        carregarPedidos();
        // Respeitar preferência de auto-refresh ao abrir a aba
        console.log('🔍 Verificando preferência de auto-refresh:', adminPrefs.autoRefresh);
        if (adminPrefs.autoRefresh) iniciarAutoRefresh(); else pararAutoRefresh();
    }
    // Atualizar KPIs ao abrir a aba "Relatórios"
    else if (tabId === 'tab-relatorios') {
        console.log('📊 Aba Relatórios aberta - carregando e atualizando dados');
        console.log('📦 Pedidos atuais no array:', pedidos.length);
        
        // Se já tiver pedidos carregados, atualizar imediatamente
        if (pedidos.length > 0) {
            console.log('✅ Usando pedidos já carregados');
            atualizarKpis();
        }
        
        // Sempre carregar pedidos para sincronizar (atualiza em background)
        carregarPedidos().then(() => {
            console.log('✅ Pedidos recarregados, atualizando KPIs novamente');
            atualizarKpis();
        }).catch(err => {
            console.error('❌ Erro ao carregar pedidos:', err);
            // Mesmo em caso de erro, atualizar KPIs com dados atuais
            atualizarKpis();
        });
        // Manter auto-refresh ativo na aba de relatórios se preferência estiver ativada
        console.log('🔍 Verificando preferência de auto-refresh para relatórios:', adminPrefs.autoRefresh);
        if (adminPrefs.autoRefresh) iniciarAutoRefresh(); else pararAutoRefresh();
    }
    else {
        // Pausar auto-refresh quando sair da aba de pedidos
        pararAutoRefresh();
    }
}

async function carregarPedidos() {
    try {
        console.log('🔄 Iniciando carregamento de pedidos...');
        console.log('🔍 Auto-refresh interval ID:', autoRefreshInterval);
        console.trace('📍 Chamado de:'); // Mostra de onde foi chamado
        
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('pedidos-container').classList.add('hidden');
        document.getElementById('empty-state').classList.add('hidden');

        console.log('📡 Fazendo requisição para:', `${API_BASE}/pedidos`);
        console.log('📋 Headers:', tenantHeaders);
        
        const response = await fetchTenant('/pedidos');
        console.log('📥 Resposta recebida:', response.status, response.ok);
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('📦 Dados recebidos:', result);

        if (result.success) {
            const anteriores = new Set(pedidos.map(p => p.id));
            pedidos = result.pedidos.sort((a, b) => new Date(b.data) - new Date(a.data));
            
            // Sempre renderizar e atualizar KPIs
            renderizarPedidos();
            atualizarKpis();

            // Detectar novos pedidos apenas se não for primeira vez e há pedidos anteriores
            const novos = pedidos.filter(p => !anteriores.has(p.id) && anteriores.size > 0);
            if (!primeiraVez && novos.length > 0) {
                console.log(`🔔 ${novos.length} novo(s) pedido(s) detectado(s)!`);
                
                // Tocar som se ativo
                if (somAtivo) {
                    console.log('🔊 Tocando som...');
                    audioNovo.volume = 1.0;
                    audioNovo.play().then(() => {
                        console.log('✅ Som tocado com sucesso');
                    }).catch(err => {
                        console.error('❌ Erro ao tocar som:', err);
                    });
                }
                
                // Auto confirmar novos pedidos se ativo
                if (autoConfirmar) {
                    novos.forEach(async (pedido) => {
                        if (pedido.status === 'pendente') {
                            console.log(`✅ Auto confirmando pedido #${pedido.numero_pedido || pedido.id}...`);
                            await atualizarStatus(pedido.id, 'confirmado');
                            
                            // Imprimir após confirmar
                            setTimeout(() => {
                                console.log(`🖨️ Imprimindo pedido #${pedido.numero_pedido || pedido.id} automaticamente...`);
                                imprimirPedido(pedido.id);
                            }, 1000);
                        }
                    });
                } else {
                    // Imprimir automaticamente apenas pedidos já confirmados
                    novos.forEach(pedido => {
                        if (pedido.status === 'confirmado') {
                            console.log(`🖨️ Imprimindo pedido #${pedido.numero_pedido || pedido.id} automaticamente...`);
                            setTimeout(() => imprimirPedido(pedido.id), 500);
                        }
                    });
                }
            }
            primeiraVez = false;
            ultimoPedidoIds = new Set(pedidos.map(p => p.id));
        } else {
            console.warn('⚠️ Resposta do servidor sem success:', result);
            mostrarConfirmacao('❌ Erro', 'Erro ao carregar pedidos');
        }
    } catch (error) {
        console.error('❌ Erro detalhado:', error);
        console.error('Stack:', error.stack);
        mostrarConfirmacao('❌ Erro', `Erro ao conectar: ${error.message}`);
    } finally {
        document.getElementById('loading').classList.add('hidden');
    }
}

// Liga eventos de UI (refresh, auto, som) após funções principais
(function inicializarControlesAdmin() {
    ajustarLinksTenant();

    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => carregarPedidos());

    const toggleAuto = document.getElementById('toggle-auto-refresh');
    const toggleSomEl = document.getElementById('toggle-som');
    const toggleAutoConfirmarEl = document.getElementById('toggle-auto-confirmar');

    // Aplicar preferências salvas aos toggles
    if (toggleAuto) toggleAuto.checked = !!adminPrefs.autoRefresh;
    if (toggleSomEl) toggleSomEl.checked = !!adminPrefs.somAtivo;
    if (toggleAutoConfirmarEl) toggleAutoConfirmarEl.checked = !!adminPrefs.autoConfirmar;

    if (toggleAuto) toggleAuto.addEventListener('change', (e) => {
        const on = !!e.target.checked;
        console.log('🎚️ Toggle auto-refresh mudou para:', on);
        adminPrefs.autoRefresh = on;
        localStorage.setItem('adminPrefs', JSON.stringify(adminPrefs));
        if (on) iniciarAutoRefresh(); else pararAutoRefresh();
    });

    if (toggleSomEl) toggleSomEl.addEventListener('change', (e) => {
        somAtivo = !!e.target.checked;
        adminPrefs.somAtivo = somAtivo;
        localStorage.setItem('adminPrefs', JSON.stringify(adminPrefs));
        
        // Testar som ao ativar
        if (somAtivo) {
            console.log('🔊 Testando som...');
            audioNovo.play().then(() => {
                console.log('✅ Som de teste tocado com sucesso');
            }).catch(err => {
                console.error('❌ Erro ao tocar som de teste:', err);
                mostrarModal('erro', 'Erro ao tocar som', 'Verifique se o arquivo existe e se o navegador permite reprodução automática.');
            });
        }
    });

    if (toggleAutoConfirmarEl) toggleAutoConfirmarEl.addEventListener('change', (e) => {
        autoConfirmar = !!e.target.checked;
        adminPrefs.autoConfirmar = autoConfirmar;
        localStorage.setItem('adminPrefs', JSON.stringify(adminPrefs));
        console.log('✅ Auto confirmação:', autoConfirmar ? 'ATIVADA' : 'DESATIVADA');
        mostrarModal('sucesso', 'Auto Confirmação', `Auto confirmação ${autoConfirmar ? 'ativada' : 'desativada'} com sucesso!`);
    });
})();

function filtrarPedidos() {
    const filtrados = pedidos.filter(p => {
        const byStatus = filtroAtivo === 'todos' ? true : p.status === filtroAtivo;
        const termo = searchTerm.trim().toLowerCase();
        const bySearch = termo === '' ? true : (p.cliente.nome.toLowerCase().includes(termo) || (p.cliente.whatsapp || '').toLowerCase().includes(termo));
        const byPagamento = filtroPagamento === 'todos' ? true : (p.pagamento && p.pagamento.forma === filtroPagamento);
        const byTipo = filtroTipo === 'todos' ? true : (p.tipoEntrega === filtroTipo);
        return byStatus && bySearch && byPagamento && byTipo;
    });
    
    // Debug: Contar status de todos os pedidos
    const statusCount = {};
    pedidos.forEach(p => {
        statusCount[p.status] = (statusCount[p.status] || 0) + 1;
    });
    console.log('📊 Status dos pedidos:', statusCount);
    
    return filtrados;
}

// Variável global para o chart
let chartStatusGlobal = null;

function desenharGraficoStatus(pendentes, confirmados, entregues, cancelados) {
    const canvas = document.getElementById('chart-status');
    if (!canvas) {
        console.warn('⚠️ Canvas para gráfico não encontrado');
        return;
    }

    const ctx = canvas.getContext('2d');

    // Destruir gráfico anterior se existir
    if (chartStatusGlobal) {
        chartStatusGlobal.destroy();
    }

    chartStatusGlobal = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Pendentes', 'Confirmados', 'Entregues', 'Cancelados'],
            datasets: [{
                data: [pendentes, confirmados, entregues, cancelados],
                backgroundColor: [
                    '#f59e0b',  // Amarelo - Pendentes
                    '#10b981',  // Verde - Confirmados
                    '#3b82f6',  // Azul - Entregues
                    '#ef4444'   // Vermelho - Cancelados
                ],
                borderColor: [
                    '#d97706',
                    '#059669',
                    '#2563eb',
                    '#dc2626'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    }
                }
            }
        }
    });

    console.log('✅ Gráfico de status desenhado com sucesso');
}

function atualizarKpis() {
    console.log('📊 atualizarKpis() chamado. Total de pedidos:', pedidos.length);
    console.log('📦 Dados de pedidos:', pedidos);
    
    const totalDia = pedidos.reduce((sum, p) => sum + (p.total || 0), 0);
    const pendentes = pedidos.filter(p => p.status === 'pendente').length;
    const confirmados = pedidos.filter(p => p.status === 'confirmado').length;
    const cancelados = pedidos.filter(p => p.status === 'cancelado').length;
    const totalPedidos = pedidos.length;
    const entregues = pedidos.filter(p => p.status === 'entregue').length;
    const menorPedido = pedidos.length > 0 ? Math.min(...pedidos.map(p => p.total || 0)) : 0;
    const maiorPedido = pedidos.length > 0 ? Math.max(...pedidos.map(p => p.total || 0)) : 0;
    const ticketMedio = totalPedidos > 0 ? totalDia / totalPedidos : 0;
    const taxaConclusao = totalPedidos > 0 ? (entregues + confirmados) / totalPedidos * 100 : 0;
    
    console.log('📊 KPIs calculados:', { totalDia, pendentes, confirmados, cancelados, totalPedidos, entregues, maiorPedido, menorPedido, ticketMedio, taxaConclusao });
    
    // ===== KPI CARDS (Parte superior) =====
    // Total de Pedidos
    const elemTotalPedidos = document.getElementById('stat-total-pedidos-rel');
    if (elemTotalPedidos) {
        elemTotalPedidos.textContent = totalPedidos;
        console.log('✅ stat-total-pedidos-rel atualizado para:', totalPedidos);
    } else {
        console.warn('⚠️ Elemento stat-total-pedidos-rel não encontrado!');
    }
    
    // Faturamento Total
    if (document.getElementById('total-faturamento')) {
        document.getElementById('total-faturamento').textContent = `R$ ${totalDia.toFixed(2).replace('.', ',')}`;
    }
    
    // Taxa de Conclusão
    if (document.getElementById('taxa-conclusao')) {
        document.getElementById('taxa-conclusao').textContent = `${taxaConclusao.toFixed(1)}%`;
    }
    
    // Ticket Médio
    if (document.getElementById('ticket-medio')) {
        document.getElementById('ticket-medio').textContent = `R$ ${ticketMedio.toFixed(2).replace('.', ',')}`;
    }
    
    // ===== DETALHES DE STATUS =====
    if (document.getElementById('stat-pendentes-rel')) {
        document.getElementById('stat-pendentes-rel').textContent = pendentes;
    }
    if (document.getElementById('stat-confirmados-rel')) {
        document.getElementById('stat-confirmados-rel').textContent = confirmados;
    }
    if (document.getElementById('stat-cancelados-rel')) {
        document.getElementById('stat-cancelados-rel').textContent = cancelados;
    }
    if (document.getElementById('stat-entregues-rel')) {
        document.getElementById('stat-entregues-rel').textContent = entregues;
    }
    
    // ===== ANÁLISE FINANCEIRA =====
    if (document.getElementById('maior-pedido')) {
        document.getElementById('maior-pedido').textContent = `R$ ${maiorPedido.toFixed(2).replace('.', ',')}`;
    }
    if (document.getElementById('menor-pedido')) {
        document.getElementById('menor-pedido').textContent = `R$ ${menorPedido.toFixed(2).replace('.', ',')}`;
    }
    if (document.getElementById('stat-entregues-count')) {
        document.getElementById('stat-entregues-count').textContent = entregues;
    }
    if (document.getElementById('pedido-antigo')) {
        if (pedidos.length > 0) {
            const pedidoAntigo = new Date(Math.min(...pedidos.map(p => new Date(p.data).getTime())));
            const dataFormatada = pedidoAntigo.toLocaleDateString('pt-BR');
            document.getElementById('pedido-antigo').textContent = dataFormatada;
        } else {
            document.getElementById('pedido-antigo').textContent = 'N/A';
        }
    }
    
    // ===== RESUMO DETALHADO (Tabela) =====
    if (document.getElementById('resumo-faturamento')) {
        document.getElementById('resumo-faturamento').textContent = `R$ ${totalDia.toFixed(2).replace('.', ',')}`;
    }
    if (document.getElementById('resumo-ticket')) {
        document.getElementById('resumo-ticket').textContent = `R$ ${ticketMedio.toFixed(2).replace('.', ',')}`;
    }
    if (document.getElementById('resumo-total')) {
        document.getElementById('resumo-total').textContent = totalPedidos;
    }
    if (document.getElementById('resumo-taxa')) {
        document.getElementById('resumo-taxa').textContent = `${taxaConclusao.toFixed(1)}%`;
    }
    
    // ===== DESENHAR GRÁFICO DE STATUS =====
    desenharGraficoStatus(pendentes, confirmados, entregues, cancelados);
    
    // Manter KPIs antigos para compatibilidade
    if (document.getElementById('kpi-total-dia')) {
        document.getElementById('kpi-total-dia').textContent = `R$${totalDia.toFixed(2).replace('.', ',')}`;
    }
    if (document.getElementById('kpi-pendentes')) {
        document.getElementById('kpi-pendentes').textContent = pendentes;
    }
    if (document.getElementById('kpi-entregues')) {
        document.getElementById('kpi-entregues').textContent = entregues;
    }
}

function renderizarPedidos() {
    const container = document.getElementById('pedidos-container');
    const pedidosFiltrados = filtrarPedidos();

    console.log(`📋 Renderizando pedidos. Total: ${pedidos.length}, Filtrados: ${pedidosFiltrados.length}, Filtro atual: ${filtroAtivo}`);

    if (pedidosFiltrados.length === 0) {
        container.classList.add('hidden');
        document.getElementById('empty-state').classList.remove('hidden');
        console.log('ℹ️ Nenhum pedido para exibir com o filtro atual');
        return;
    }

    container.classList.remove('hidden');
    document.getElementById('empty-state').classList.add('hidden');

    container.innerHTML = pedidosFiltrados.map(pedido => {
        const data = new Date(pedido.data);
        const dataFormatada = data.toLocaleDateString('pt-BR') + ' às ' + data.toLocaleTimeString('pt-BR');
        const forma = pedido.pagamento && pedido.pagamento.forma ? pedido.pagamento.forma : 'nao informado';
        const isPix = forma === 'pix';
        const pixExpira = pedido.pagamento && pedido.pagamento.pixExpiraEm ? new Date(pedido.pagamento.pixExpiraEm) : null;
        const expirou = pixExpira ? pixExpira.getTime() < Date.now() : false;
        const tipoEntrega = pedido.tipoEntrega === 'delivery' ? 'Delivery' : 'Retirada';
        const whatsappLimpo = encodeURIComponent((pedido.cliente.whatsapp || '').replace(/\D/g, ''));

        return `
            <div class="pedido-card ${pedido.status} bg-white p-6 rounded-lg shadow-md">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="text-xl font-bold">#${pedido.id}</h3>
                        <p class="text-sm text-gray-600">${dataFormatada}</p>
                    </div>
                    <div class="flex flex-col items-end gap-2">
                        <span class="px-3 py-1 rounded-full text-sm font-semibold ${getStatusClass(pedido.status)}">
                            ${getStatusText(pedido.status)}
                        </span>
                        <span class="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">${tipoEntrega}</span>
                        <span class="px-2 py-1 rounded-full text-xs ${isPix ? (expirou ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700') : 'bg-gray-100 text-gray-700'}">
                            ${isPix ? (expirou ? 'Pix expirado' : 'Pix') : forma.toUpperCase()}
                        </span>
                    </div>
                </div>

                <div class="mb-4">
                    <h4 class="font-bold mb-2"><i class="fa fa-user"></i> Cliente</h4>
                    <p><strong>Nome:</strong> ${pedido.cliente.nome}</p>
                    <p><strong>WhatsApp:</strong> ${pedido.cliente.whatsapp}</p>
                    <div class="flex gap-2 mt-2 flex-wrap text-sm">
                        <button onclick="copiarTexto('${pedido.cliente.whatsapp}', 'whatsapp')" class="px-3 py-1 border rounded hover:bg-gray-100 transition">📋 Copiar WhatsApp</button>
                        <a href="https://wa.me/55${whatsappLimpo}" target="_blank" class="px-3 py-1 border rounded flex items-center gap-1 hover:bg-green-50 transition"><i class="fa fa-whatsapp text-green-600"></i> Abrir WhatsApp</a>
                    </div>
                </div>

                <div class="mb-4">
                    <h4 class="font-bold mb-2"><i class="fa fa-shopping-cart"></i> Itens</h4>
                    ${pedido.itens.map(item => `
                        <div class="flex justify-between py-1 border-b text-sm">
                            <span>${item.nome} x${item.quantidade}</span>
                            <span class="font-semibold">R$${item.precoTotal.toFixed(2).replace('.', ',')}</span>
                        </div>
                    `).join('')}
                </div>

                <div class="mb-4">
                    <h4 class="font-bold mb-2"><i class="fa fa-truck"></i> Entrega</h4>
                    <p><strong>Tipo:</strong> ${tipoEntrega}</p>
                    ${pedido.tipoEntrega === 'delivery' ? `
                        <p><strong>Endereço:</strong> ${pedido.endereco}</p>
                        <p><strong>Bairro:</strong> ${pedido.bairro}</p>
                        <p><strong>Taxa:</strong> R$${pedido.taxaEntrega.toFixed(2).replace('.', ',')}</p>
                        <button onclick="copiarTexto('${pedido.endereco.replace(/'/g, "\\'")}')" class="mt-2 px-3 py-1 border rounded text-sm">Copiar endereço</button>
                    ` : ''}
                </div>

                ${pedido.observacoes ? `
                    <div class="mb-4">
                        <h4 class="font-bold mb-2"><i class="fa fa-comment"></i> Observações</h4>
                        <p class="text-gray-700">${pedido.observacoes}</p>
                    </div>
                ` : ''}

                <div class="mb-4">
                    <h4 class="font-bold mb-2"><i class="fa fa-credit-card"></i> Pagamento</h4>
                    <p><strong>Forma:</strong> ${forma.toUpperCase()}</p>
                    ${isPix ? `
                        <p><strong>Pix copia e cola:</strong> ${pedido.pagamento.pixCodigo || ''}</p>
                        ${pixExpira ? `<p><strong>Expira:</strong> ${pixExpira.toLocaleString('pt-BR')} ${expirou ? '(expirado)' : ''}</p>` : ''}
                    ` : ''}
                </div>

                <div class="flex justify-between items-center pt-4 border-t">
                    <p class="text-xl font-bold">Total: R$${pedido.total.toFixed(2).replace('.', ',')}</p>
                    <div class="flex gap-2 flex-wrap justify-end">
                        <button onclick="imprimirPedido('${pedido.id}')" class="px-3 py-1 border rounded text-sm flex items-center gap-1"><i class="fa fa-print"></i> Imprimir</button>
                        <select onchange="atualizarStatus('${pedido.id}', this.value)" class="border border-gray-300 rounded-lg px-3 py-2">
                            <option value="pendente" ${pedido.status === 'pendente' ? 'selected' : ''}>Pendente</option>
                            <option value="confirmado" ${pedido.status === 'confirmado' ? 'selected' : ''}>Confirmado</option>
                            <option value="pronto" ${pedido.status === 'pronto' ? 'selected' : ''}>Pronto</option>
                            <option value="a_caminho" ${pedido.status === 'a_caminho' ? 'selected' : ''}>A Caminho</option>
                            <option value="entregue" ${pedido.status === 'entregue' ? 'selected' : ''}>Entregue</option>
                            <option value="cancelado" ${pedido.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function getStatusClass(status) {
    const classes = {
        pendente: 'bg-yellow-100 text-yellow-800',
        confirmado: 'bg-green-100 text-green-800',
        pronto: 'bg-purple-100 text-purple-800',
        a_caminho: 'bg-indigo-100 text-indigo-800',
        entregue: 'bg-blue-100 text-blue-800',
        cancelado: 'bg-red-100 text-red-800'
    };
    return classes[status] || 'bg-gray-100 text-gray-800';
}

function getStatusText(status) {
    const texts = {
        pendente: 'Pendente',
        confirmado: 'Confirmado',
        pronto: 'Pronto',
        a_caminho: 'A Caminho',
        entregue: 'Entregue',
        cancelado: 'Cancelado'
    };
    return texts[status] || status;
}

async function atualizarStatus(pedidoId, novoStatus) {
    try {
        const response = await fetchTenant(`/pedidos/${pedidoId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: novoStatus })
        });

        const result = await response.json();

        if (result.success) {
            console.log(`✅ Status do pedido ${pedidoId} atualizado para ${novoStatus}`);
            
            // Enviar WhatsApp automático se configurado
            if (result.whatsappEnviado) {
                console.log('📱 WhatsApp enviado automaticamente');
            }
            
            await carregarPedidos();
            mostrarModal('sucesso', 'Status atualizado', `Status do pedido alterado para: ${novoStatus.toUpperCase()}`);
        } else {
            mostrarModal('erro', 'Erro ao atualizar', result.message || 'Erro ao atualizar status');
        }
    } catch (error) {
        console.error('Erro:', error);
        mostrarModal('erro', 'Erro de conexão', 'Erro ao conectar com o servidor');
    }
}

function copiarTexto(texto, tipo = 'texto') {
    navigator.clipboard.writeText(texto || '').then(() => {
        if (tipo === 'whatsapp') {
            mostrarModal('sucesso', '📱 WhatsApp Copiado!', `Número ${texto} copiado para a área de transferência.`);
        } else {
            mostrarModal('sucesso', '✅ Copiado!', 'Conteúdo copiado para a área de transferência.');
        }
    }).catch(err => {
        mostrarModal('erro', 'Erro ao copiar', 'Não foi possível copiar. Tente novamente.');
    });
}

function abrirModalConfirmacao() {
    const cardNumber = document.getElementById('card-number').value.trim();
    const cardExpiry = document.getElementById('card-expiry').value.trim();
    const cardCvv = document.getElementById('card-cvv').value.trim();
    const cardHolder = document.getElementById('card-holder').value.trim();
    const billingEmail = document.getElementById('billing-email').value.trim();

    // Validações básicas
    if (!cardNumber || !cardExpiry || !cardCvv || !cardHolder || !billingEmail) {
        mostrarConfirmacao('❌ Erro', 'Por favor, preencha todos os campos');
        return;
    }

    if (cardNumber.replace(/\s/g, '').length < 13) {
        mostrarConfirmacao('❌ Erro', 'Número do cartão inválido');
        return;
    }

    if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
        mostrarConfirmacao('❌ Erro', 'Validade deve estar no formato MM/AA');
        return;
    }

    if (cardCvv.length < 3) {
        mostrarConfirmacao('❌ Erro', 'CVV deve ter pelo menos 3 dígitos');
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail)) {
        mostrarConfirmacao('❌ Erro', 'Email inválido');
        return;
    }

    // Mascarar o número do cartão para exibição
    const cardMasked = cardNumber.replace(/\d(?=\d{4})/g, '*');

    mostrarConfirmacao(
        '💳 Confirmar Dados de Pagamento',
        `Cartão: ${cardMasked}\nTitular: ${cardHolder}\nEmail: ${billingEmail}\n\nDeseja continuar?`,
        () => {
            // Salvar dados no localStorage (em produção seria uma API segura)
            localStorage.setItem('paymentData', JSON.stringify({
                cardNumber: cardNumber.replace(/\s/g, ''),
                cardExpiry,
                cardHolder,
                billingEmail,
                savedAt: new Date().toISOString()
            }));

            document.getElementById('payment-form').reset();
            mostrarConfirmacao('✅ Sucesso', 'Dados de pagamento salvos com sucesso!');
            console.log('💾 Dados de pagamento salvos');
        }
    );
}

async function salvarDadosEmpresa() {
    const companyWhatsapp = document.getElementById('company-whatsapp').value.trim();
    const contactWhatsapp = document.getElementById('contact-whatsapp').value.trim();
    const locationLink = document.getElementById('location-link').value.trim();
    const companyName = document.getElementById('company-name').value.trim();
    const businessHoursSchedule = coletarHorarioFuncionamento();
    const statusOverride = localStorage.getItem('statusOverride') ? JSON.parse(localStorage.getItem('statusOverride')) : null;

    // Validações básicas
    if (!companyWhatsapp || !contactWhatsapp || !companyName) {
        mostrarConfirmacao('❌ Erro', 'Por favor, preencha os campos obrigatórios:\n- WhatsApp da Empresa\n- WhatsApp para Contato\n- Nome da Empresa');
        return;
    }

    // Salvar no localStorage
    const companyData = {
        companyWhatsapp,
        contactWhatsapp,
        locationLink,
        companyName,
        businessHoursSchedule,
        statusOverride,
        savedAt: new Date().toISOString()
    };

    localStorage.setItem('companyData', JSON.stringify(companyData));

    try {
        const response = await fetchTenant('/company-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyData })
        });
        const result = await response.json();
        if (result.success) {
            mostrarConfirmacao('✅ Sucesso', 'Dados da empresa salvos e sincronizados!');
        } else {
            mostrarConfirmacao('⚠️ Aviso', 'Salvou localmente, mas falhou ao sincronizar.');
        }
    } catch (error) {
        console.error('Erro ao sincronizar dados da empresa:', error);
        mostrarConfirmacao('⚠️ Aviso', 'Dados salvos localmente. Não foi possível sincronizar agora.');
    }

    console.log('💾 Dados da empresa salvos:', companyData);
}

// Recarrega os dados salvos do formulário "Meus Dados"
async function carregarDadosEmpresa() {
    let data = null;

    try {
        const resp = await fetchTenant('/company-data');
        const json = await resp.json();
        console.log('📦 Resposta da API company-data:', json);
        if (json.success && json.companyData && Object.keys(json.companyData).length > 0) {
            data = json.companyData;
            console.log('✅ Dados da empresa carregados do servidor:', data);
        }
    } catch (error) {
        console.warn('⚠️ Não foi possível carregar dados do servidor, tentando localStorage', error);
    }

    if (!data) {
        const saved = localStorage.getItem('companyData');
        if (saved) {
            try {
                data = JSON.parse(saved);
                console.log('📁 Dados carregados do localStorage:', data);
            } catch (error) {
                console.error('❌ Erro ao parsear dados locais:', error);
            }
        }
    }

    if (!data) {
        console.warn('⚠️ Nenhum dado encontrado');
        return;
    }

    const map = {
        'company-whatsapp': data.companyWhatsapp,
        'contact-whatsapp': data.contactWhatsapp,
        'location-link': data.locationLink,
        'company-name': data.companyName
    };

    console.log('🔧 Mapeamento de campos:', map);

    Object.entries(map).forEach(([id, value]) => {
        const el = document.getElementById(id);
        console.log(`Campo ${id}:`, el ? 'encontrado' : 'NÃO encontrado', 'valor:', value);
        if (el && value) {
            el.value = value;
            console.log(`✅ Campo ${id} preenchido com:`, value);
        }
    });

    // Carrega statusOverride
    if (data.statusOverride !== undefined && data.statusOverride !== null) {
        localStorage.setItem('statusOverride', JSON.stringify(data.statusOverride));
    }

    if (data.businessHoursSchedule) {
        console.log('📅 Aplicando horários:', data.businessHoursSchedule);
        aplicarHorarioFuncionamento(data.businessHoursSchedule);
    }
}

// Coleta horários por dia do formulário
function coletarHorarioFuncionamento() {
    const dias = [];
    for (let i = 0; i < 7; i++) {
        const open = document.getElementById(`hours-day-${i}-open`)?.value || '';
        const close = document.getElementById(`hours-day-${i}-close`)?.value || '';
        const closed = document.getElementById(`hours-day-${i}-closed`)?.checked || false;
        dias.push({ dayIndex: i, open, close, closed });
    }
    return dias;
}

// Aplica horários no formulário
function aplicarHorarioFuncionamento(schedule) {
    if (!Array.isArray(schedule)) return;
    schedule.forEach(item => {
        const { dayIndex, open, close, closed } = item || {};
        const openEl = document.getElementById(`hours-day-${dayIndex}-open`);
        const closeEl = document.getElementById(`hours-day-${dayIndex}-close`);
        const closedEl = document.getElementById(`hours-day-${dayIndex}-closed`);
        if (openEl && typeof open === 'string') openEl.value = open;
        if (closeEl && typeof close === 'string') closeEl.value = close;
        if (closedEl && typeof closed === 'boolean') closedEl.checked = closed;
        atualizarEstadoInputsHorario(dayIndex);
    });
}

function atualizarEstadoInputsHorario(dayIndex) {
    const closedEl = document.getElementById(`hours-day-${dayIndex}-closed`);
    const openEl = document.getElementById(`hours-day-${dayIndex}-open`);
    const closeEl = document.getElementById(`hours-day-${dayIndex}-close`);
    if (!closedEl || !openEl || !closeEl) return;
    const isClosed = closedEl.checked;
    openEl.disabled = isClosed;
    closeEl.disabled = isClosed;
    openEl.classList.toggle('bg-gray-100', isClosed);
    closeEl.classList.toggle('bg-gray-100', isClosed);
}

function aplicarPadraoHorario() {
    const base = [
        { dayIndex: 0, open: '18:30', close: '23:00', closed: false },
        { dayIndex: 1, open: '18:30', close: '23:00', closed: false },
        { dayIndex: 2, open: '18:30', close: '23:00', closed: false },
        { dayIndex: 3, open: '', close: '', closed: true },
        { dayIndex: 4, open: '18:30', close: '23:00', closed: false },
        { dayIndex: 5, open: '18:30', close: '23:00', closed: false },
        { dayIndex: 6, open: '18:30', close: '23:00', closed: false }
    ];
    aplicarHorarioFuncionamento(base);
}

function limparHorario() {
    for (let i = 0; i < 7; i++) {
        const openEl = document.getElementById(`hours-day-${i}-open`);
        const closeEl = document.getElementById(`hours-day-${i}-close`);
        const closedEl = document.getElementById(`hours-day-${i}-closed`);
        if (openEl) openEl.value = '';
        if (closeEl) closeEl.value = '';
        if (closedEl) closedEl.checked = false;
        atualizarEstadoInputsHorario(i);
    }
}

function imprimirPedido(id) {
    const pedido = pedidos.find(p => p.id === id);
    if (!pedido) {
        mostrarModal('erro', 'Pedido não encontrado', 'Não foi possível localizar o pedido para impressão.');
        return;
    }
    
    // Criar janela de impressão
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    const itensHtml = pedido.itens.map(item => `
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.quantidade}x</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.nome}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">R$ ${item.preco.toFixed(2).replace('.', ',')}</td>
        </tr>
    `).join('');
    
    const dataFormatada = new Date(pedido.data).toLocaleString('pt-BR');
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Pedido #${pedido.numero_pedido || pedido.id}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                    max-width: 800px;
                    margin: 0 auto;
                }
                .header {
                    text-align: center;
                    border-bottom: 2px solid #000;
                    padding-bottom: 20px;
                    margin-bottom: 20px;
                }
                .header h1 {
                    margin: 0;
                    font-size: 24px;
                }
                .info-section {
                    margin-bottom: 20px;
                    padding: 10px;
                    background-color: #f5f5f5;
                    border-radius: 5px;
                }
                .info-section h3 {
                    margin: 0 0 10px 0;
                    font-size: 16px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                }
                th {
                    background-color: #333;
                    color: white;
                    padding: 10px;
                    text-align: left;
                }
                .total {
                    text-align: right;
                    font-size: 20px;
                    font-weight: bold;
                    margin-top: 20px;
                    padding-top: 10px;
                    border-top: 2px solid #000;
                }
                .status {
                    display: inline-block;
                    padding: 5px 15px;
                    border-radius: 20px;
                    font-weight: bold;
                    margin-top: 10px;
                }
                .status-pendente { background-color: #fef3c7; color: #92400e; }
                .status-confirmado { background-color: #d1fae5; color: #065f46; }
                .status-pronto { background-color: #e9d5ff; color: #6b21a8; }
                .status-entregue { background-color: #dbeafe; color: #1e40af; }
                .status-cancelado { background-color: #fee2e2; color: #991b1b; }
                @media print {
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🍞 Pedido #${pedido.numero_pedido || pedido.id}</h1>
                <p>${dataFormatada}</p>
                <span class="status status-${pedido.status}">${pedido.status.toUpperCase()}</span>
            </div>
            
            <div class="info-section">
                <h3>👤 Informações do Cliente</h3>
                <p><strong>Nome:</strong> ${pedido.cliente.nome}</p>
                <p><strong>WhatsApp:</strong> ${pedido.cliente.whatsapp}</p>
            </div>
            
            <div class="info-section">
                <h3>📦 Tipo de Entrega</h3>
                <p><strong>${pedido.tipoEntrega === 'delivery' ? '🚗 Delivery' : '🏪 Retirada'}</strong></p>
                ${pedido.tipoEntrega === 'delivery' && pedido.endereco ? `
                    <p><strong>Endereço:</strong> ${pedido.endereco.rua}, ${pedido.endereco.numero}</p>
                    ${pedido.endereco.complemento ? `<p><strong>Complemento:</strong> ${pedido.endereco.complemento}</p>` : ''}
                    <p><strong>Bairro:</strong> ${pedido.endereco.bairro}</p>
                ` : ''}
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th style="width: 80px;">Qtd</th>
                        <th>Item</th>
                        <th style="width: 120px; text-align: right;">Preço</th>
                    </tr>
                </thead>
                <tbody>
                    ${itensHtml}
                </tbody>
            </table>
            
            ${pedido.observacoes ? `
                <div class="info-section">
                    <h3>📝 Observações</h3>
                    <p>${pedido.observacoes}</p>
                </div>
            ` : ''}
            
            ${pedido.pagamento ? `
                <div class="info-section">
                    <h3>💳 Forma de Pagamento</h3>
                    <p><strong>${pedido.pagamento.forma || 'Não informado'}</strong></p>
                    ${pedido.pagamento.troco ? `<p><strong>Troco para:</strong> R$ ${pedido.pagamento.troco.toFixed(2).replace('.', ',')}</p>` : ''}
                </div>
            ` : ''}
            
            <div class="total">
                TOTAL: R$ ${pedido.total.toFixed(2).replace('.', ',')}
            </div>
            
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(() => window.close(), 500);
                }
            </script>
        </body>
        </html>
    `);
    
    printWindow.document.close();
}

// Funções do Cardápio - Visualização (Início)
let categoriaViewAtiva = 'all';
let categoriaEditAtiva = 'all';

function renderizarCardapioView() {
    const container = document.getElementById('cardapio-view-grid');
    if (!container) return;
    
    // Filtrar apenas itens ativos
    const itensFiltrados = (categoriaViewAtiva === 'all' 
        ? menu 
        : menu.filter(item => item.category === categoriaViewAtiva))
        .filter(item => item.ativo);
    
    container.innerHTML = itensFiltrados.map(item => `
        <div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition flex">
            <img src="${item.image}" alt="${item.name}" class="w-24 h-24 object-cover" onerror="this.src='./assets/default.jpg'">
            <div class="flex-1 p-3 flex flex-col justify-between">
                <div>
                    <h3 class="font-bold text-sm mb-1">${item.name}</h3>
                    <p class="text-xs text-gray-500 uppercase">${getCategoryName(item.category)}</p>
                </div>
                <p class="text-green-600 font-bold text-lg">R$ ${item.price.toFixed(2).replace('.', ',')}</p>
            </div>
        </div>
    `).join('');
}

// Funções do Cardápio - Edição (Meus Itens)
function renderizarCardapioEdit() {
    const container = document.getElementById('cardapio-edit-grid');
    if (!container) return;
    
    const itensFiltrados = categoriaEditAtiva === 'all' 
        ? menu.map((item, idx) => ({...item, originalIndex: idx}))
        : menu.map((item, idx) => ({...item, originalIndex: idx})).filter(item => item.category === categoriaEditAtiva);
    
    container.innerHTML = itensFiltrados.map(item => `
        <div class="bg-white rounded-lg shadow-lg overflow-hidden transition hover:shadow-xl ${!item.ativo ? 'opacity-60' : ''}">
            <div class="p-4 text-center">
                <img src="${item.image}" alt="${item.name}" class="w-32 h-32 object-cover rounded mx-auto mb-3" onerror="this.src='./assets/default.jpg'">
                <h3 class="font-bold text-base mb-1">${item.name}</h3>
                <p class="text-xs text-gray-500 uppercase mb-2">${getCategoryName(item.category)}</p>
                ${!item.ativo ? '<span class="text-xs text-red-600 font-bold bg-red-50 px-2 py-1 rounded inline-block mb-2">DESABILITADO</span>' : ''}
                <p class="text-green-600 font-bold text-lg">R$ ${item.price.toFixed(2).replace('.', ',')}</p>
            </div>
            <div class="border-t px-3 py-2 bg-gray-50 grid grid-cols-3 gap-2">
                <button onclick="editarItem(${item.originalIndex}); event.stopPropagation();" style="background-color: #2563eb;" class="text-white font-semibold py-2 rounded text-sm flex items-center justify-center gap-2 hover:opacity-90 transition">
                    <i class="fa fa-edit"></i> Editar
                </button>
                <button onclick="toggleItemAtivo(${item.originalIndex}); event.stopPropagation();" style="background-color: ${item.ativo ? '#ea580c' : '#16a34a'};" class="text-white font-semibold py-2 rounded text-sm flex items-center justify-center gap-2 hover:opacity-90 transition" title="${item.ativo ? 'Desabilitar' : 'Habilitar'}">
                    <i class="fa fa-${item.ativo ? 'eye-slash' : 'eye'}"></i> ${item.ativo ? 'Desab.' : 'Hab.'}
                </button>
                <button onclick="deletarItem(${item.originalIndex}); event.stopPropagation();" style="background-color: #dc2626;" class="text-white font-semibold py-2 rounded text-sm flex items-center justify-center gap-2 hover:opacity-90 transition" title="Deletar">
                    <i class="fa fa-trash"></i> Del.
                </button>
            </div>
        </div>
    `).join('');
}

// ============ PROMOÇÕES EM ITENS ============

let itemPromotions = [];

async function carregarItemPromotions() {
    try {
        const response = await fetchTenant('/item-promotions');
        const data = await response.json();
        if (data.success) {
            itemPromotions = data.promotions || [];
            renderizarItemPromotionsList();
        }
    } catch (error) {
        console.error('Erro ao carregar promoções:', error);
    }
}

function renderizarItemPromotionsList() {
    const container = document.getElementById('item-promotions-list');
    if (!container) return;

    if (itemPromotions.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhum desconto adicionado.</p>';
        return;
    }

    container.innerHTML = itemPromotions.map(promo => {
        // Buscar o item no cardápio para obter informações
        const cardapioItem = menu.find(m => m.name === promo.itemName);
        const precoOriginal = cardapioItem?.price || 0;
        const precoFinal = precoOriginal * (1 - promo.discount / 100);
        const economiza = precoOriginal - precoFinal;

        return `
            <div class="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border border-green-200 shadow-sm">
                <div class="flex items-center justify-between">
                    <div class="flex-1">
                        <h3 class="font-bold text-lg">${promo.itemName}</h3>
                        ${promo.description ? `<p class="text-sm text-gray-600">${promo.description}</p>` : ''}
                        <div class="flex items-center gap-3 mt-2">
                            <span class="text-sm line-through text-gray-400">R$ ${precoOriginal.toFixed(2).replace('.', ',')}</span>
                            <span class="text-xl font-bold text-green-600">R$ ${precoFinal.toFixed(2).replace('.', ',')}</span>
                            <span class="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-semibold">-${promo.discount}%</span>
                            <span class="text-xs text-gray-600">economiza R$ ${economiza.toFixed(2).replace('.', ',')}</span>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="editarItemPromo('${promo.itemName}')" class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition">
                            <i class="fa fa-edit"></i>
                        </button>
                        <button onclick="deletarItemPromo('${promo.itemName}')" class="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition">
                            <i class="fa fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function abrirModalItemDiscount(itemName = null) {
    const modal = document.getElementById('item-discount-modal');
    const select = document.getElementById('discount-item-select');
    
    // Preencher select com itens do cardápio
    select.innerHTML = '<option value="">-- Escolha um item --</option>' + 
        (menu || []).map(item => `<option value="${item.name}">${item.name}</option>`).join('');

    if (itemName) {
        // Editar existente
        const promo = itemPromotions.find(p => p.itemName === itemName);
        if (promo) {
            select.value = itemName;
            document.getElementById('discount-percent').value = promo.discount;
            document.getElementById('discount-description').value = promo.description || '';
        }
    } else {
        // Novo
        document.getElementById('discount-percent').value = '';
        document.getElementById('discount-description').value = '';
    }

    modal.classList.remove('hidden');
}

async function salvarItemPromo() {
    const itemName = document.getElementById('discount-item-select').value;
    const discount = parseFloat(document.getElementById('discount-percent').value);
    const description = document.getElementById('discount-description').value;

    if (!itemName || isNaN(discount) || discount < 0 || discount > 100) {
        mostrarModal('aviso', 'Dados incompletos', 'Preencha todos os campos corretamente. O desconto deve estar entre 0 e 100.');
        return;
    }

    try {
        const response = await fetchTenant('/item-promotions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemName, discount, description, ativo: true })
        });

        const data = await response.json();
        if (data.success) {
            await carregarItemPromotions();
            fecharModalItemDiscount();
            console.log('✅ Desconto salvo com sucesso');
        } else {
            mostrarModal('erro', 'Erro ao salvar', data.message || 'Erro ao salvar desconto');
            console.error('Erro ao salvar:', data);
        }
    } catch (error) {
        console.error('Erro ao salvar desconto:', error);
        mostrarModal('erro', 'Erro ao salvar', 'Erro ao salvar desconto: ' + error.message);
    }
}

function editarItemPromo(itemName) {
    abrirModalItemDiscount(itemName);
}

async function deletarItemPromo(itemName) {
    if (!confirm(`Deseja remover o desconto de "${itemName}"?`)) return;

    try {
        const response = await fetchTenant(`/item-promotions/${encodeURIComponent(itemName)}`, {
            method: 'DELETE'
        });

        const data = await response.json();
        if (data.success) {
            await carregarItemPromotions();
            console.log('✅ Desconto removido');
        }
    } catch (error) {
        console.error('Erro ao deletar desconto:', error);
    }
}

function fecharModalItemDiscount() {
    document.getElementById('item-discount-modal').classList.add('hidden');
}

// Promoções - CRUD simples
function renderizarPromotionsEdit() {
    const container = document.getElementById('promotions-edit-grid');
    if (!container) return;
    if (!Array.isArray(promotions)) promotions = [];
    if (promotions.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm">Nenhuma promoção cadastrada.</p>';
        return;
    }

    container.innerHTML = promotions.map((promo, idx) => {
        const precoOriginal = promo.priceOriginal ?? promo.price ?? 0;
        const precoPromo = promo.pricePromo ?? promo.price ?? 0;
        const ativo = promo.ativo !== false;
        const isCombo = promo.type === 'combo' && promo.items && Array.isArray(promo.items);
        
        let itemsInfo = '';
        if (isCombo) {
            itemsInfo = `<div class="text-xs text-orange-700 mt-1">📦 ${promo.items.length} item(ns): ${promo.items.map(i => i.name).join(', ')}</div>`;
        }
        
        return `
            <div class="bg-white rounded-lg shadow-lg overflow-hidden transition hover:shadow-xl ${!ativo ? 'opacity-60' : ''}">
                <div class="p-4 flex gap-3">
                    <img src="${promo.image || './assets/default.jpg'}" alt="${promo.name || 'Promoção'}" class="w-24 h-24 object-cover rounded" onerror="this.src='./assets/default.jpg'">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            <h3 class="font-bold text-lg">${promo.name || 'Sem nome'}</h3>
                            ${isCombo ? '<span class="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">COMBO</span>' : ''}
                            ${ativo ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">ATIVA</span>' : '<span class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">OCULTA</span>'}
                        </div>
                        <p class="text-sm text-gray-600 line-clamp-2">${promo.description || ''}</p>
                        ${itemsInfo}
                        <div class="mt-2 flex items-center gap-2 text-sm">
                            <span class="line-through text-gray-400">R$ ${Number(precoOriginal).toFixed(2).replace('.', ',')}</span>
                            <span class="font-bold text-red-600">R$ ${Number(precoPromo).toFixed(2).replace('.', ',')}</span>
                        </div>
                    </div>
                </div>
                <div class="border-t px-3 py-2 bg-gray-50 grid grid-cols-3 gap-2">
                    <button onclick="abrirModalPromocao(${idx}, '${isCombo ? 'combo' : 'manual'}'); event.stopPropagation();" class="bg-blue-600 text-white font-semibold py-2 rounded text-sm flex items-center justify-center gap-2 hover:opacity-90 transition">
                        <i class="fa fa-edit"></i> Editar
                    </button>
                    <button onclick="togglePromotionAtivo(${idx}); event.stopPropagation();" class="${ativo ? 'bg-orange-500' : 'bg-green-600'} text-white font-semibold py-2 rounded text-sm flex items-center justify-center gap-2 hover:opacity-90 transition" title="${ativo ? 'Ocultar' : 'Ativar'}">
                        <i class="fa fa-${ativo ? 'eye-slash' : 'eye'}"></i> ${ativo ? 'Desab.' : 'Hab.'}
                    </button>
                    <button onclick="deletarPromocao(${idx}); event.stopPropagation();" class="bg-red-600 text-white font-semibold py-2 rounded text-sm flex items-center justify-center gap-2 hover:opacity-90 transition" title="Deletar">
                        <i class="fa fa-trash"></i> Del.
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function abrirModalPromocao(index, mode = 'manual') {
    editingPromotionIndex = index;
    promotionMode = mode;
    selectedComboItems = [];
    
    const promo = promotions[index] || {};
    
    // Alternar abas
    const manualTab = document.getElementById('promo-manual-tab');
    const comboTab = document.getElementById('promo-combo-tab');
    const manualContent = document.getElementById('promo-manual-content');
    const comboContent = document.getElementById('promo-combo-content');
    
    if (mode === 'manual') {
        promotionMode = 'manual';
        manualTab.classList.add('active');
        comboTab.classList.remove('active');
        manualContent.style.display = 'block';
        comboContent.style.display = 'none';
        
        document.getElementById('promo-name').value = promo.name || '';
        document.getElementById('promo-description').value = promo.description || '';
        document.getElementById('promo-price-original').value = promo.priceOriginal ?? promo.price ?? '';
        document.getElementById('promo-price-promo').value = promo.pricePromo ?? promo.price ?? '';
        document.getElementById('promo-image').value = promo.image || '';
        document.getElementById('promo-active').checked = promo.ativo !== false;
        document.getElementById('promo-image-file').value = '';
        const preview = document.getElementById('promo-image-preview');
        if (promo.image) {
            document.getElementById('promo-preview-img').src = promo.image;
            preview.style.display = 'block';
        } else {
            preview.style.display = 'none';
        }
    } else if (mode === 'combo') {
        promotionMode = 'combo';
        manualTab.classList.remove('active');
        comboTab.classList.add('active');
        manualContent.style.display = 'none';
        comboContent.style.display = 'block';
        
        document.getElementById('combo-name').value = promo.name || '';
        document.getElementById('combo-description').value = promo.description || '';
        document.getElementById('combo-price-promo').value = promo.pricePromo ?? '';
        document.getElementById('combo-active').checked = promo.ativo !== false;
        document.getElementById('combo-image').value = promo.image || '';
        document.getElementById('combo-image-file').value = '';
        
        // Restaurar itens selecionados se editando
        if (promo.items && Array.isArray(promo.items)) {
            selectedComboItems = [...promo.items];
        }
        
        renderizarFiltrosCategoria();
        renderizarChecklistCombo();
        atualizarPrecoCombo();
        
        const preview = document.getElementById('combo-image-preview');
        if (promo.image) {
            document.getElementById('combo-preview-img').src = promo.image;
            preview.style.display = 'block';
        } else {
            preview.style.display = 'none';
        }
    }
    
    document.getElementById('promotion-modal').classList.remove('hidden');
}

function fecharModalPromocao() {
    document.getElementById('promotion-modal').classList.add('hidden');
    editingPromotionIndex = null;
    promotionMode = 'manual';
    selectedComboItems = [];
    comboFilterCategory = 'todos';
}

function obterCategoriasDoCardapio() {
    const allItems = menu || [];
    const categoriasMap = {};
    
    // Mapear emoji e nome para cada categoria (padrão + customizadas)
    const categoriaInfo = { ...categoriasPadrao };

    // Adicionar/atualizar com customizadas (inclui overrides das padrão)
    customCategories.forEach(cat => {
        categoriaInfo[cat.key] = { emoji: cat.emoji || '📦', nome: cat.nome };
    });

    // Garantir que todas as categorias customizadas apareçam mesmo sem itens
    customCategories.forEach(cat => {
        if (!categoriasMap[cat.key]) {
            categoriasMap[cat.key] = {
                key: cat.key,
                emoji: cat.emoji || '📦',
                nome: cat.nome,
                itens: []
            };
        }
    });
    
    // Detectar categorias presentes no cardápio
    allItems.forEach(item => {
        const cat = item.category;
        if (cat && !categoriasMap[cat]) {
            const info = categoriaInfo[cat] || { emoji: '📦', nome: cat.charAt(0).toUpperCase() + cat.slice(1) };
            categoriasMap[cat] = {
                key: cat,
                emoji: info.emoji,
                nome: info.nome,
                itens: []
            };
        }
        if (cat && categoriasMap[cat]) {
            categoriasMap[cat].itens.push(item);
        }
    });
    
    return categoriasMap;
}

function renderizarFiltrosCategoria() {
    const filtersContainer = document.getElementById('combo-category-filters');
    if (!filtersContainer) return;
    
    const categorias = obterCategoriasDoCardapio();
    
    let html = `
        <button onclick="filtrarComboCategoria('todos'); event.preventDefault();" 
                class="combo-cat-filter px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    comboFilterCategory === 'todos' 
                    ? 'bg-orange-600 text-white shadow-md' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }" 
                data-category="todos">
            ✨ Todos
        </button>
    `;
    
    Object.values(categorias).forEach(cat => {
        html += `
            <button onclick="filtrarComboCategoria('${cat.key}'); event.preventDefault();" 
                    class="combo-cat-filter px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        comboFilterCategory === cat.key 
                        ? 'bg-orange-600 text-white shadow-md' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }" 
                    data-category="${cat.key}">
                ${cat.emoji} ${cat.nome}
            </button>
        `;
    });
    
    filtersContainer.innerHTML = html;
}

function filtrarComboCategoria(categoria) {
    comboFilterCategory = categoria;
    renderizarFiltrosCategoria();
    renderizarChecklistCombo();
}

function renderizarChecklistCombo() {
    const container = document.getElementById('combo-items-list');
    if (!container) return;
    
    // Mostrar TODOS os itens (ativos ou não) para permitir seleção
    const allItems = menu || [];
    if (allItems.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhum item no cardápio</p>';
        return;
    }
    
    // Organizar itens por categoria dinamicamente
    const categorias = obterCategoriasDoCardapio();
    
    // Renderizar itens agrupados por categoria com melhor layout
    let html = '<div class="space-y-4">';
    
    Object.values(categorias).forEach(categoria => {
        // Filtrar por categoria se não for "todos"
        if (comboFilterCategory !== 'todos' && categoria.key !== comboFilterCategory) {
            return;
        }
        
        if (categoria.itens.length > 0) {
            html += `
                <div class="space-y-2">
                    <div class="sticky top-0 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-3 py-2 rounded-lg font-bold text-sm shadow-md z-10">
                        ${categoria.emoji} ${categoria.nome} <span class="font-normal opacity-80">(${categoria.itens.length})</span>
                    </div>
                    <div class="grid grid-cols-3 gap-2">
            `;
            
            categoria.itens.forEach(item => {
                const isSelected = selectedComboItems.some(sItem => sItem.name === item.name);
                const imageSrc = item.image || './assets/default.jpg';
                html += `
                    <label class="flex flex-col items-center gap-2 p-2 border-2 rounded-lg cursor-pointer transition-all ${isSelected ? 'bg-blue-50 border-blue-500 shadow-lg scale-105' : 'border-gray-200 hover:border-orange-400 hover:shadow-md'}">
                        <input type="checkbox" 
                               ${isSelected ? 'checked' : ''} 
                               onchange="toggleComboItem({name: '${item.name.replace(/'/g, "\\'")}', price: ${item.price}, image: '${item.image.replace(/'/g, "\\'")}'}, this.checked); event.stopPropagation();"
                               class="w-5 h-5 rounded cursor-pointer accent-orange-500" />
                        <img src="${imageSrc}" alt="${item.name}" class="w-full h-20 object-cover rounded" onerror="this.src='./assets/default.jpg'">
                        <div class="text-center w-full px-1">
                            <div class="font-semibold text-gray-800 text-xs leading-tight mb-1" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${item.name}</div>
                            <div class="text-xs text-orange-600 font-bold">R$ ${Number(item.price).toFixed(2).replace('.', ',')}</div>
                        </div>
                    </label>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function toggleComboItem(item, isChecked) {
    if (isChecked) {
        if (!selectedComboItems.some(sItem => sItem.name === item.name)) {
            selectedComboItems.push(item);
        }
    } else {
        selectedComboItems = selectedComboItems.filter(sItem => sItem.name !== item.name);
    }
    renderizarChecklistCombo();
    atualizarPrecoCombo();
}

function atualizarPrecoCombo() {
    if (selectedComboItems.length === 0) {
        document.getElementById('combo-price-original-display').textContent = 'R$ 0,00';
        document.getElementById('combo-items-display').textContent = 'Nenhum item selecionado';
        return;
    }
    
    const total = selectedComboItems.reduce((sum, item) => sum + item.price, 0);
    const itemNames = selectedComboItems.map(item => item.name).join(', ');
    document.getElementById('combo-price-original-display').textContent = `R$ ${Number(total).toFixed(2).replace('.', ',')}`;
    document.getElementById('combo-items-display').textContent = `${selectedComboItems.length} item(ns): ${itemNames}`;
    
    // Atualizar visualização de economia
    const pricePromo = parseFloat(document.getElementById('combo-price-promo').value) || 0;
    if (pricePromo > 0 && pricePromo < total) {
        const economia = total - pricePromo;
        document.getElementById('combo-savings-display').textContent = `Economize: R$ ${Number(economia).toFixed(2).replace('.', ',')}`;
    } else {
        document.getElementById('combo-savings-display').textContent = '';
    }
}

async function salvarPromocao() {
    if (promotionMode === 'manual') {
        await salvarPromocaoManual();
    } else if (promotionMode === 'combo') {
        await salvarPromocaoCombo();
    }
}

async function salvarPromocaoManual() {
    const name = document.getElementById('promo-name').value.trim();
    const description = document.getElementById('promo-description').value.trim();
    const priceOriginal = parseFloat(document.getElementById('promo-price-original').value);
    const pricePromo = parseFloat(document.getElementById('promo-price-promo').value);
    let image = document.getElementById('promo-image').value.trim();
    const fileInput = document.getElementById('promo-image-file');
    const ativo = document.getElementById('promo-active').checked;

    if (!name || isNaN(priceOriginal) || isNaN(pricePromo)) {
        mostrarConfirmacao('❌ Erro', 'Preencha nome, preço original e preço promocional.');
        return;
    }

    // Se um arquivo foi selecionado, fazer upload antes de salvar
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
        try {
            const formData = new FormData();
            formData.append('image', fileInput.files[0]);
            const response = await fetchTenant('/upload-image', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.success && data.imageUrl) {
                image = data.imageUrl;
            } else {
                mostrarConfirmacao('❌ Erro no Upload', 'Falha ao fazer upload da imagem da promoção.');
                return;
            }
        } catch (error) {
            mostrarConfirmacao('❌ Erro', 'Erro ao fazer upload da imagem: ' + error.message);
            return;
        }
    }

    const promo = { name, description, priceOriginal, pricePromo, image, ativo };

    if (editingPromotionIndex === null) {
        promotions.push(promo);
    } else {
        promotions[editingPromotionIndex] = promo;
    }

    renderizarPromotionsEdit();
    await sincronizarPromotions();
    fecharModalPromocao();
}

async function salvarPromocaoCombo() {
    const name = document.getElementById('combo-name').value.trim();
    const description = document.getElementById('combo-description').value.trim();
    const pricePromo = parseFloat(document.getElementById('combo-price-promo').value);
    let image = document.getElementById('combo-image').value.trim();
    const fileInput = document.getElementById('combo-image-file');
    const ativo = document.getElementById('combo-active').checked;

    if (!name || selectedComboItems.length === 0 || isNaN(pricePromo)) {
        mostrarConfirmacao('❌ Erro', 'Selecione pelo menos 1 item, defina o preço promocional.');
        return;
    }

    // Calcular preço original
    const priceOriginal = selectedComboItems.reduce((sum, item) => sum + item.price, 0);

    // Se um arquivo foi selecionado, fazer upload antes de salvar
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
        try {
            const formData = new FormData();
            formData.append('image', fileInput.files[0]);
            const response = await fetchTenant('/upload-image', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.success && data.imageUrl) {
                image = data.imageUrl;
            } else {
                mostrarConfirmacao('❌ Erro no Upload', 'Falha ao fazer upload da imagem do combo.');
                return;
            }
        } catch (error) {
            mostrarConfirmacao('❌ Erro', 'Erro ao fazer upload da imagem: ' + error.message);
            return;
        }
    }

    const promo = { 
        name, 
        description, 
        priceOriginal, 
        pricePromo, 
        image, 
        ativo,
        items: selectedComboItems,
        type: 'combo'
    };

    if (editingPromotionIndex === null) {
        promotions.push(promo);
    } else {
        promotions[editingPromotionIndex] = promo;
    }

    renderizarPromotionsEdit();
    await sincronizarPromotions();
    fecharModalPromocao();
}

async function deletarPromocao(index) {
    const nome = promotions[index]?.name || 'esta promoção';
    mostrarConfirmacao('⚠️ Confirmar Exclusão', `Tem certeza que deseja deletar "${nome}"?`, async () => {
        promotions.splice(index, 1);
        renderizarPromotionsEdit();
        await sincronizarPromotions();
        fecharConfirmacao();
    }, true);
}

async function togglePromotionAtivo(index) {
    promotions[index].ativo = promotions[index].ativo === false;
    renderizarPromotionsEdit();
    await sincronizarPromotions();
}

async function sincronizarPromotions() {
    try {
        await fetchTenant('/promotions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ promotions })
        });
    } catch (error) {
        console.error('❌ Erro ao sincronizar promoções:', error);
    }
}

// Funções do Modal de Confirmação
function mostrarConfirmacao(titulo, mensagem, callback = null, mostrarCancelar = false) {
    document.getElementById('confirmation-title').textContent = titulo;
    document.getElementById('confirmation-message').textContent = mensagem;
    document.getElementById('confirmation-cancel-btn').style.display = mostrarCancelar ? 'block' : 'none';
    confirmationCallback = callback;
    document.getElementById('confirmation-modal').classList.remove('hidden');
}

function fecharConfirmacao() {
    document.getElementById('confirmation-modal').classList.add('hidden');
    confirmationCallback = null;
}

// Funções do Modal de Edição
function abrirModalEdicao(index) {
    editingItemIndex = index;
    const item = menu[index];
    
    document.getElementById('edit-item-name').value = item.name;
    document.getElementById('edit-item-category').value = item.category;
    document.getElementById('edit-item-description').value = item.description || '';
    document.getElementById('edit-item-price').value = item.price;
    document.getElementById('edit-item-image').value = item.image;
    document.getElementById('edit-item-active').checked = item.ativo;
    document.getElementById('edit-item-image-file').value = '';
    
    // Mostrar preview se houver imagem
    if (item.image) {
        document.getElementById('preview-img').src = item.image;
        document.getElementById('edit-item-image-preview').style.display = 'block';
    } else {
        document.getElementById('edit-item-image-preview').style.display = 'none';
    }
    
    document.getElementById('edit-item-modal').classList.remove('hidden');
}

function abrirModalNovoItem() {
    editingItemIndex = null;
    
    document.getElementById('edit-item-name').value = '';
    document.getElementById('edit-item-category').value = 'burguers';
    document.getElementById('edit-item-description').value = '';
    document.getElementById('edit-item-price').value = '';
    document.getElementById('edit-item-image').value = '';
    document.getElementById('edit-item-active').checked = true;
    document.getElementById('edit-item-image-file').value = '';
    document.getElementById('edit-item-image-preview').style.display = 'none';
    
    document.getElementById('edit-item-modal').classList.remove('hidden');
}

function fecharModalEdicao() {
    document.getElementById('edit-item-modal').classList.add('hidden');
    editingItemIndex = null;
}

async function salvarEdicaoItem() {
    const nome = document.getElementById('edit-item-name').value.trim();
    const categoria = document.getElementById('edit-item-category').value;
    const descricao = document.getElementById('edit-item-description').value.trim();
    const preco = parseFloat(document.getElementById('edit-item-price').value);
    let imagem = document.getElementById('edit-item-image').value.trim();
    const ativo = document.getElementById('edit-item-active').checked;
    const fileInput = document.getElementById('edit-item-image-file');
    
    if (!nome || isNaN(preco) || preco < 0) {
        mostrarConfirmacao('❌ Erro', 'Por favor, preencha todos os campos obrigatórios corretamente!');
        return;
    }
    
    // Se um arquivo foi selecionado, fazer upload
    if (fileInput.files && fileInput.files.length > 0) {
        try {
            const formData = new FormData();
            formData.append('image', fileInput.files[0]);
            
            const response = await fetchTenant('/upload-image', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            if (data.success) {
                imagem = data.imageUrl;
            } else {
                mostrarConfirmacao('❌ Erro no Upload', 'Falha ao fazer upload da imagem: ' + (data.message || 'Erro desconhecido'));
                return;
            }
        } catch (error) {
            mostrarConfirmacao('❌ Erro', 'Erro ao fazer upload da imagem: ' + error.message);
            return;
        }
    }
    
    // Se editingItemIndex é null, é um novo item
    if (editingItemIndex === null) {
        const novoItem = {
            name: nome,
            category: categoria,
            description: descricao,
            price: preco,
            image: imagem,
            ativo: ativo
        };
        menu.push(novoItem);
        mostrarConfirmacao('✅ Sucesso', 'Novo item adicionado com sucesso!');
    } else {
        // Editar item existente
        menu[editingItemIndex].name = nome;
        menu[editingItemIndex].category = categoria;
        menu[editingItemIndex].description = descricao;
        menu[editingItemIndex].price = preco;
        menu[editingItemIndex].image = imagem;
        menu[editingItemIndex].ativo = ativo;
        mostrarConfirmacao('✅ Sucesso', 'Item atualizado com sucesso!');
    }
    
    renderizarCardapioEdit();
    renderizarCardapioView();
    sincronizarCardapio();
    fecharModalEdicao();
}

// Funções de gerenciamento de itens
function editarItem(index) {
    abrirModalEdicao(index);
}


function toggleItemAtivo(index) {
    menu[index].ativo = !menu[index].ativo;
    renderizarCardapioEdit();
    renderizarCardapioView();
    sincronizarCardapio();
}

function deletarItem(index) {
    const itemName = menu[index].name;
    mostrarConfirmacao(
        '⚠️ Confirmar Exclusão',
        `Tem certeza que deseja deletar "${itemName}"?`,
        () => {
            menu.splice(index, 1);
            renderizarCardapioEdit();
            renderizarCardapioView();
            sincronizarCardapio();
            fecharConfirmacao();
        },
        true
    );
}

// Sincronizar cardápio com o servidor (SEM re-renderizar aqui)
async function sincronizarCardapio() {
    try {
        const response = await fetchTenant('/cardapio', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ cardapio: menu })
        });
        
        const data = await response.json();
        if (data.success) {
            console.log('✅ Cardápio sincronizado com sucesso!');
        }
    } catch (error) {
        console.error('❌ Erro ao sincronizar cardápio:', error);
    }
}

function getCategoryName(category) {
    const names = {
        'burguers': 'Burguers',
        'pizzas': 'Pizzas',
        'porcoes': 'Porções',
        'sobremesas': 'Sobremesas',
        'bebidas': 'Bebidas'
    };
    return names[category] || category;
}

// Funções de Gerenciamento de Categorias
const categoriasPadrao = {
    burguers: { emoji: '🍔', nome: 'Burguers' },
    pizzas: { emoji: '🍕', nome: 'Pizzas' },
    porcoes: { emoji: '🍟', nome: 'Porções' },
    sobremesas: { emoji: '🍰', nome: 'Sobremesas' },
    bebidas: { emoji: '🥤', nome: 'Bebidas' }
};

function atualizarFiltrosCategoria() {
    const container = document.getElementById('category-filters-container');
    if (!container) return;
    
    const categorias = obterCategoriasDoCardapio();
    
    let html = `
        <button class="category-edit-btn active px-4 py-2 rounded-lg bg-red-500 text-white font-semibold" data-cat="all">
            <i class="fa fa-th"></i> Todos
        </button>
    `;
    
    Object.values(categorias).forEach(cat => {
        html += `
            <button class="category-edit-btn px-4 py-2 rounded-lg bg-gray-300 font-semibold hover:bg-red-500 hover:text-white" data-cat="${cat.key}">
                ${cat.emoji} ${cat.nome}
            </button>
        `;
    });
    
    container.innerHTML = html;
    
    // Re-adicionar event listeners
    document.querySelectorAll('.category-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-edit-btn').forEach(b => {
                b.classList.remove('active', 'bg-red-500', 'text-white');
                b.classList.add('bg-gray-300');
            });
            btn.classList.remove('bg-gray-300');
            btn.classList.add('active', 'bg-red-500', 'text-white');
            categoriaEditAtiva = btn.dataset.cat;
            renderizarCardapioEdit();
        });
    });
}

function atualizarFiltrosView() {
    const container = document.getElementById('category-view-filters');
    if (!container) return;
    
    const categorias = obterCategoriasDoCardapio();
    
    let html = `
        <button class="category-view-btn active px-4 py-2 rounded-lg bg-red-500 text-white font-semibold" data-cat="all">
            <i class="fa fa-th"></i> Todos
        </button>
    `;
    
    Object.values(categorias).forEach(cat => {
        const iconMap = {
            burguers: 'fa-burger',
            pizzas: 'fa-pizza-slice',
            porcoes: 'fa-drumstick-bite',
            sobremesas: 'fa-cake-candles',
            bebidas: 'fa-wine-glass'
        };
        const icon = iconMap[cat.key] || 'fa-box';
        
        html += `
            <button class="category-view-btn px-4 py-2 rounded-lg bg-gray-300 font-semibold hover:bg-red-500 hover:text-white" data-cat="${cat.key}">
                <i class="fa ${icon}"></i> ${cat.nome}
            </button>
        `;
    });
    
    container.innerHTML = html;
    
    // Re-adicionar event listeners
    document.querySelectorAll('.category-view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-view-btn').forEach(b => {
                b.classList.remove('active', 'bg-red-500', 'text-white');
                b.classList.add('bg-gray-300');
            });
            btn.classList.remove('bg-gray-300');
            btn.classList.add('active', 'bg-red-500', 'text-white');
            categoriaViewAtiva = btn.dataset.cat;
            renderizarCardapioView();
        });
    });
}

function atualizarSelectCategorias() {
    const select = document.getElementById('edit-item-category');
    if (!select) return;
    
    const categorias = obterCategoriasDoCardapio();
    
    select.innerHTML = Object.values(categorias).map(cat => 
        `<option value="${cat.key}">${cat.emoji} ${cat.nome}</option>`
    ).join('');
}

function abrirGerenciarCategorias() {
    renderCategoriasModal();
    document.getElementById('category-modal').classList.remove('hidden');
}

function fecharModalCategoria() {
    document.getElementById('category-modal').classList.add('hidden');
}

function renderCategoriasModal() {
    const list = document.getElementById('categories-list');
    if (!list) return;

    const linhas = [];

    // Mapa mesclado: começa com padrão e aplica overrides custom
    const merged = { ...categoriasPadrao };
    customCategories.forEach(cat => {
        merged[cat.key] = { emoji: cat.emoji || '📦', nome: cat.nome };
    });

    // Render padrões (com overrides se existirem)
    Object.keys(categoriasPadrao).forEach(key => {
        const cat = merged[key] || categoriasPadrao[key];
        linhas.push(criarLinhaCategoria(key, cat.nome, cat.emoji || '📦', false, {
            keyLocked: true,
            deletable: false,
            badgeText: 'padrão'
        }));
    });

    // Render custom (exclui os que já são padrão)
    customCategories.forEach(cat => {
        if (categoriasPadrao[cat.key]) return; // já renderizado acima
        linhas.push(criarLinhaCategoria(cat.key, cat.nome, cat.emoji || '📦', false, {
            keyLocked: false,
            deletable: true,
            badgeText: ''
        }));
    });

    list.innerHTML = linhas.join('');
}

function criarLinhaCategoria(key = '', nome = '', emoji = '📦', isNew = true, options = {}) {
    const { keyLocked = false, deletable = true, badgeText = '' } = options;
    return `
        <div class="border rounded-lg p-3 flex items-center gap-2" data-row="${key}" data-new="${isNew}">
            <input class="w-16 border rounded px-2 py-1 text-center" maxlength="2" value="${emoji}" data-field="emoji" title="Emoji" />
            <input class="w-32 border rounded px-2 py-1 text-sm" placeholder="id" value="${key}" data-field="key" ${keyLocked ? 'disabled' : ''} title="Identificador (minúsculo)" />
            <input class="flex-1 border rounded px-2 py-1 text-sm" placeholder="Nome de exibição" value="${nome}" data-field="nome" />
            ${badgeText ? `<span class="text-xs text-gray-500">${badgeText}</span>` : (isNew ? '<span class="text-xs text-gray-500">novo</span>' : '')}
            ${deletable ? '<button class="text-red-600 hover:text-red-700 px-2" data-action="delete" title="Remover"><i class="fa fa-trash"></i></button>' : ''}
        </div>
    `;
}

function adicionarLinhaCategoria() {
    const list = document.getElementById('categories-list');
    if (!list) return;
    list.insertAdjacentHTML('beforeend', criarLinhaCategoria('', '', '📦', true, { keyLocked: false, deletable: true }));
}

async function salvarCategorias() {
    const list = document.getElementById('categories-list');
    if (!list) return;

    const rows = Array.from(list.querySelectorAll('[data-row]'));
    const catMap = {};

    for (const row of rows) {
        const emoji = (row.querySelector('[data-field="emoji"]')?.value || '📦').trim();
        const keyRaw = (row.querySelector('[data-field="key"]')?.value || '').trim().toLowerCase();
        const nome = (row.querySelector('[data-field="nome"]')?.value || '').trim();

        // Sanitizar key
        const key = keyRaw
            .replace(/[áàãâä]/g, 'a')
            .replace(/[éèêë]/g, 'e')
            .replace(/[íìîï]/g, 'i')
            .replace(/[óòõôö]/g, 'o')
            .replace(/[úùûü]/g, 'u')
            .replace(/[ç]/g, 'c')
            .replace(/[^a-z0-9]/g, '');

        if (!key || !nome) {
            mostrarConfirmacao('❌ Erro', 'Preencha todos os campos das categorias.');
            return;
        }

        // Última linha com mesmo key prevalece (permite editar padrão)
        catMap[key] = { key, nome, emoji: emoji || '📦' };
    }

    // Guardar todas as categorias (inclusive overrides das padrão) como customCategories
    customCategories = Object.values(catMap);

    try {
        const response = await fetchTenant('/custom-categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categories: customCategories })
        });

        if (!response.ok) throw new Error('Erro na requisição');
        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'Erro ao salvar');

        mostrarConfirmacao('✅ Sucesso', 'Categorias atualizadas!');
        atualizarFiltrosCategoria();
        atualizarSelectCategorias();
        fecharModalCategoria();
    } catch (error) {
        console.error('Erro ao salvar categorias:', error);
        mostrarConfirmacao('❌ Erro', 'Erro ao salvar categorias: ' + error.message);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', async function() {
    ajustarLinksTenant();
    // Limpar auto-refresh para evitar reloads acidentais
    localStorage.removeItem('autoRefresh');

    // Carregar pedidos logo ao iniciar (para relatórios funcionarem sem depender da aba Ver pedidos)
    console.log('🚀 Carregando pedidos iniciais...');
    try {
        await carregarPedidos();
        console.log('✅ Pedidos iniciais carregados:', pedidos.length);
    } catch (error) {
        console.warn('⚠️ Erro ao carregar pedidos iniciais:', error);
    }

    // Preencher formulário "Meus Dados" com o que já foi salvo
    await carregarDadosEmpresa();

    // Listeners de horário
    for (let i = 0; i < 7; i++) {
        const closedEl = document.getElementById(`hours-day-${i}-closed`);
        if (closedEl) {
            closedEl.addEventListener('change', () => atualizarEstadoInputsHorario(i));
        }
    }
    const btnPadrao = document.getElementById('hours-apply-default');
    if (btnPadrao) btnPadrao.addEventListener('click', aplicarPadraoHorario);
    const btnClear = document.getElementById('hours-clear');
    if (btnClear) btnClear.addEventListener('click', limparHorario);
    
    // Carregar cardápio do servidor se existir
    try {
        const response = await fetchTenant('/cardapio');
        const data = await response.json();
        if (data.success && data.cardapio && Array.isArray(data.cardapio)) {
            menu = data.cardapio;
            console.log('✅ Cardápio carregado do servidor');
            atualizarFiltrosCategoria();
            atualizarSelectCategorias();
            renderizarCardapioView();
            renderizarCardapioEdit();
        }
    } catch (error) {
        console.warn('⚠️ Não foi possível carregar cardápio do servidor:', error);
    }
    
    // Carregar categorias customizadas
    try {
        const catResponse = await fetchTenant('/custom-categories');
        const catData = await catResponse.json();
        if (catData.success && Array.isArray(catData.categories)) {
            customCategories = catData.categories;
            console.log('✅ Categorias customizadas carregadas');
            atualizarFiltrosCategoria();
            atualizarFiltrosView();
            atualizarSelectCategorias();
        }
    } catch (error) {
        console.warn('⚠️ Não foi possível carregar categorias customizadas:', error);
    }

    // Carregar promoções do servidor se existir
    try {
        const respPromo = await fetchTenant('/promotions');
        const dataPromo = await respPromo.json();
        if (dataPromo.success && Array.isArray(dataPromo.promotions)) {
            promotions = dataPromo.promotions;
            console.log('✅ Promoções carregadas do servidor');
            renderizarPromotionsEdit();
        }
    } catch (error) {
        console.warn('⚠️ Não foi possível carregar promoções do servidor:', error);
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => setTab(btn.dataset.tab));
    });

    document.getElementById('refresh-btn').addEventListener('click', carregarPedidos);

    // Botão de limpar/resetar filtro nos relatórios
    const btnResetarDatas = document.getElementById('btn-resetar-datas');
    if (btnResetarDatas) {
        btnResetarDatas.addEventListener('click', () => {
            document.getElementById('data-inicio-relatorio').value = '';
            document.getElementById('data-fim-relatorio').value = '';
            console.log('🔄 Filtro de datas resetado');
            atualizarKpis();
            
            const totalPedidos = pedidos.length;
            const totalFaturamento = pedidos.reduce((sum, p) => sum + (p.total || 0), 0);
            
            abrirModalFiltro('limpar', {
                totalPedidos: totalPedidos,
                faturamento: totalFaturamento
            });
        });
    }

    // Filtro por data nos relatórios
    const btnFiltrarDatas = document.getElementById('btn-filtrar-datas');
    if (btnFiltrarDatas) {
        btnFiltrarDatas.addEventListener('click', () => {
            const dataInicio = document.getElementById('data-inicio-relatorio').value;
            const dataFim = document.getElementById('data-fim-relatorio').value;
            
            if (!dataInicio || !dataFim) {
                mostrarModal('aviso', 'Intervalo incompleto', 'Por favor, selecione uma data de início e uma data de fim.');
                return;
            }
            
            const inicio = new Date(dataInicio);
            const fim = new Date(dataFim);
            
            const pedidosFiltrados = pedidos.filter(p => {
                const dataPedido = new Date(p.data);
                return dataPedido >= inicio && dataPedido <= fim;
            });
            
            console.log(`📅 Filtro de datas aplicado: ${dataInicio} a ${dataFim}`);
            console.log(`📦 Pedidos encontrados: ${pedidosFiltrados.length}`);
            
            // Atualizar estatísticas com pedidos filtrados
            const totalFiltrado = pedidosFiltrados.reduce((sum, p) => sum + (p.total || 0), 0);
            const pendentes = pedidosFiltrados.filter(p => p.status === 'pendente').length;
            const confirmados = pedidosFiltrados.filter(p => p.status === 'confirmado').length;
            const cancelados = pedidosFiltrados.filter(p => p.status === 'cancelado').length;
            const entregues = pedidosFiltrados.filter(p => p.status === 'entregue').length;
            
            // Atualizar cards com dados filtrados
            document.getElementById('stat-total-pedidos-rel').textContent = pedidosFiltrados.length;
            document.getElementById('stat-pendentes-rel').textContent = pendentes;
            document.getElementById('stat-confirmados-rel').textContent = confirmados;
            document.getElementById('stat-cancelados-rel').textContent = cancelados;
            document.getElementById('total-faturamento').textContent = `R$ ${totalFiltrado.toFixed(2).replace('.', ',')}`;
            
            const ticketMedio = pedidosFiltrados.length > 0 ? totalFiltrado / pedidosFiltrados.length : 0;
            document.getElementById('ticket-medio').textContent = `R$ ${ticketMedio.toFixed(2).replace('.', ',')}`;
            
            const maiorPedido = pedidosFiltrados.length > 0 ? Math.max(...pedidosFiltrados.map(p => p.total || 0)) : 0;
            document.getElementById('maior-pedido').textContent = `R$ ${maiorPedido.toFixed(2).replace('.', ',')}`;
            
            const taxaConclusao = pedidosFiltrados.length > 0 ? ((entregues + confirmados) / pedidosFiltrados.length * 100).toFixed(1) : 0;
            document.getElementById('taxa-conclusao').textContent = `${taxaConclusao}%`;
            
            document.getElementById('total-cancelados').textContent = cancelados;
            
            // Abrir modal com informações do filtro
            abrirModalFiltro('filtrar', {
                totalPedidos: pedidosFiltrados.length,
                faturamento: totalFiltrado
            });
            
            // Atualizar gráfico
            desenharGraficoStatus(pendentes, confirmados, entregues, cancelados);
            
            // Atualizar resumo detalhado
            if (document.getElementById('resumo-faturamento')) {
                document.getElementById('resumo-faturamento').textContent = `R$ ${totalFiltrado.toFixed(2).replace('.', ',')}`;
            }
            if (document.getElementById('resumo-ticket')) {
                document.getElementById('resumo-ticket').textContent = `R$ ${ticketMedio.toFixed(2).replace('.', ',')}`;
            }
            if (document.getElementById('resumo-total')) {
                document.getElementById('resumo-total').textContent = pedidosFiltrados.length;
            }
            if (document.getElementById('resumo-taxa')) {
                document.getElementById('resumo-taxa').textContent = `${taxaConclusao}%`;
            }
            if (document.getElementById('stat-entregues-rel')) {
                document.getElementById('stat-entregues-rel').textContent = entregues;
            }
            if (document.getElementById('stat-entregues-count')) {
                document.getElementById('stat-entregues-count').textContent = entregues;
            }
            if (document.getElementById('menor-pedido')) {
                const menorPedido = pedidosFiltrados.length > 0 ? Math.min(...pedidosFiltrados.map(p => p.total || 0)) : 0;
                document.getElementById('menor-pedido').textContent = `R$ ${menorPedido.toFixed(2).replace('.', ',')}`;
            }
        });
    }

    const addPromotionManualBtn = document.getElementById('add-promotion-manual-btn');
    if (addPromotionManualBtn) {
        addPromotionManualBtn.addEventListener('click', () => abrirModalPromocao(null, 'manual'));
    }

    const addPromotionComboBtn = document.getElementById('add-promotion-combo-btn');
    if (addPromotionComboBtn) {
        addPromotionComboBtn.addEventListener('click', () => abrirModalPromocao(null, 'combo'));
    }

    // Event listeners para abas de promoções
    document.querySelectorAll('.promo-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.promoTab;
            
            // Atualizar active nas abas
            document.querySelectorAll('.promo-tab-btn').forEach(b => {
                b.classList.remove('active', 'border-b-2', 'border-blue-600', 'text-blue-600');
                b.classList.add('text-gray-600');
            });
            btn.classList.add('active', 'border-b-2', 'border-blue-600', 'text-blue-600');
            btn.classList.remove('text-gray-600');

            // Mostrar/ocultar conteúdo
            document.querySelectorAll('.promo-tab-content').forEach(tab => {
                tab.classList.add('hidden');
            });
            document.getElementById(`${tabName}-tab`).classList.remove('hidden');
        });
    });

    // Event listeners para modal de desconto
    const addItemDiscountBtn = document.getElementById('add-item-discount-btn');
    if (addItemDiscountBtn) {
        addItemDiscountBtn.addEventListener('click', () => abrirModalItemDiscount());
    }

    const saveDiscountBtn = document.getElementById('save-discount-btn');
    if (saveDiscountBtn) {
        saveDiscountBtn.addEventListener('click', salvarItemPromo);
    }

    const cancelDiscountBtn = document.getElementById('cancel-discount-btn');
    if (cancelDiscountBtn) {
        cancelDiscountBtn.addEventListener('click', fecharModalItemDiscount);
    }

    const closeDiscountModal = document.getElementById('close-discount-modal');
    if (closeDiscountModal) {
        closeDiscountModal.addEventListener('click', fecharModalItemDiscount);
    }

    // Fechar modal ao clicar fora
    document.getElementById('item-discount-modal').addEventListener('click', (e) => {
        if (e.target.id === 'item-discount-modal') {
            fecharModalItemDiscount();
        }
    });

    // Carregar promoções de itens
    await carregarItemPromotions();

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            console.log(`🔘 Filtro alterado para: ${btn.getAttribute('data-status')}`);
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active', 'ring-2', 'ring-white'));
            btn.classList.add('active', 'ring-2', 'ring-white');
            filtroAtivo = btn.getAttribute('data-status');
            // Renderizar sempre que o filtro mudar, não importa se está hidden ou não
            renderizarPedidos();
        });
    });

    document.getElementById('search-term').addEventListener('input', (e) => {
        searchTerm = e.target.value;
        renderizarPedidos();
    });

    document.getElementById('filter-pagamento').addEventListener('change', (e) => {
        filtroPagamento = e.target.value;
        renderizarPedidos();
    });

    document.getElementById('filter-tipo').addEventListener('change', (e) => {
        filtroTipo = e.target.value;
        renderizarPedidos();
    });

    document.getElementById('toggle-auto-refresh').addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        localStorage.setItem('autoRefresh', isChecked ? 'true' : 'false');
        if (isChecked) {
            console.log('🔄 Auto-refresh HABILITADO');
            autoRefreshInterval = setInterval(carregarPedidos, 15000);
        } else {
            console.log('✅ Auto-refresh desabilitado');
            clearInterval(autoRefreshInterval);
        }
    });

    document.getElementById('toggle-som').addEventListener('change', (e) => {
        somAtivo = e.target.checked;
        localStorage.setItem('somAtivo', somAtivo);
    });

    // Formatação automática do cartão de crédito
    const cardNumberInput = document.getElementById('card-number');
    if (cardNumberInput) {
        cardNumberInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\s/g, '');
            let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
            e.target.value = formattedValue;
        });
    }

    // Formatação automática da validade (MM/AA)
    const cardExpiryInput = document.getElementById('card-expiry');
    if (cardExpiryInput) {
        cardExpiryInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length >= 2) {
                value = value.substring(0, 2) + '/' + value.substring(2, 4);
            }
            e.target.value = value;
        });
    }

    // Event listeners para filtros de categoria do cardápio - Visualização
    document.querySelectorAll('.category-view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-view-btn').forEach(b => {
                b.classList.remove('active', 'bg-red-500', 'text-white');
                b.classList.add('bg-gray-300');
            });
            btn.classList.remove('bg-gray-300');
            btn.classList.add('active', 'bg-red-500', 'text-white');
            categoriaViewAtiva = btn.dataset.cat;
            renderizarCardapioView();
        });
    });

    // Event listeners para modal de categorias
    const manageCategoriesBtn = document.getElementById('manage-categories-btn');
    const manageCategoriesFromModalBtn = document.getElementById('manage-categories-from-modal');
    const closeCategoryModal = document.getElementById('close-category-modal');
    const cancelCategoryBtn = document.getElementById('cancel-category-btn');
    const saveCategoryBtn = document.getElementById('save-category-btn');
    const addCategoryRowBtn = document.getElementById('add-category-row');
    const categoriesList = document.getElementById('categories-list');
    
    if (manageCategoriesBtn) manageCategoriesBtn.addEventListener('click', abrirGerenciarCategorias);
    if (manageCategoriesFromModalBtn) manageCategoriesFromModalBtn.addEventListener('click', abrirGerenciarCategorias);
    if (closeCategoryModal) closeCategoryModal.addEventListener('click', fecharModalCategoria);
    if (cancelCategoryBtn) cancelCategoryBtn.addEventListener('click', fecharModalCategoria);
    if (saveCategoryBtn) saveCategoryBtn.addEventListener('click', salvarCategorias);
    if (addCategoryRowBtn) addCategoryRowBtn.addEventListener('click', adicionarLinhaCategoria);
    if (categoriesList) {
        categoriesList.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action="delete"]');
            if (!btn) return;
            const row = btn.closest('[data-row]');
            if (row) {
                row.remove();
            }
        });
    }

    // Event listeners para filtros de categoria do cardápio - Edição (já adicionados dinamicamente)

    // Event listeners para filtros de categoria do cardápio - Edição (já adicionados dinamicamente)
    // Os filtros são recriados dinamicamente em atualizarFiltrosCategoria()

    // Sistema de auto-refresh e som é gerenciado pelo código de inicialização acima (linhas 243-269)
    // Não duplicar o setInterval aqui!

    renderizarCardapioView();
    renderizarCardapioEdit();
    renderizarPromotionsEdit();
    
    // Aba ativa já foi restaurada no início do arquivo (sem flash visual)
    // Aqui apenas carregamos dados se a aba de pedidos estiver ativa
    if (!document.getElementById('tab-pedidos').classList.contains('hidden')) {
        console.log('📋 Aba de pedidos ativa na inicialização, carregando dados...');
        carregarPedidos();
    }
    
    // Event listeners do modal de confirmação
    const confirmationModal = document.getElementById('confirmation-modal');
    const confirmationOkBtn = document.getElementById('confirmation-ok-btn');
    const confirmationCancelBtn = document.getElementById('confirmation-cancel-btn');
    
    if (confirmationOkBtn) {
        confirmationOkBtn.addEventListener('click', () => {
            if (confirmationCallback && typeof confirmationCallback === 'function') {
                confirmationCallback();
            }
            fecharConfirmacao();
        });
    }
    
    if (confirmationCancelBtn) {
        confirmationCancelBtn.addEventListener('click', fecharConfirmacao);
    }
    
    if (confirmationModal) {
        confirmationModal.addEventListener('click', (e) => {
            if (e.target === confirmationModal) {
                fecharConfirmacao();
            }
        });
    }
    
    // Event listeners do modal de edição
    const editModal = document.getElementById('edit-item-modal');
    const closeModalBtn = document.getElementById('close-edit-modal');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const saveEditBtn = document.getElementById('save-edit-btn');
    const addItemBtn = document.getElementById('add-item-btn');
    const imageFileInput = document.getElementById('edit-item-image-file');
    const imageUrlInput = document.getElementById('edit-item-image');

    // Modal Promoção
    const promoModal = document.getElementById('promotion-modal');
    const closePromoBtn = document.getElementById('close-promo-modal');
    const cancelPromoBtn = document.getElementById('cancel-promo-btn');
    const savePromoBtn = document.getElementById('save-promo-btn');
    const promoFileInput = document.getElementById('promo-image-file');
    const promoImageInput = document.getElementById('promo-image');
    const promoPreview = document.getElementById('promo-image-preview');
    const promoPreviewImg = document.getElementById('promo-preview-img');
    
    if (addItemBtn) {
        addItemBtn.addEventListener('click', abrirModalNovoItem);
    }
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', fecharModalEdicao);
    }
    
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', fecharModalEdicao);
    }
    
    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', salvarEdicaoItem);
    }
    
    // Preview de imagem ao selecionar arquivo
    if (imageFileInput) {
        imageFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    document.getElementById('preview-img').src = event.target.result;
                    document.getElementById('edit-item-image-preview').style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Preview de imagem ao mudar URL
    if (imageUrlInput) {
        imageUrlInput.addEventListener('change', (e) => {
            const url = e.target.value.trim();
            if (url) {
                document.getElementById('preview-img').src = url;
                document.getElementById('edit-item-image-preview').style.display = 'block';
            } else {
                document.getElementById('edit-item-image-preview').style.display = 'none';
            }
        });
    }

    // Modal Promoção
    if (closePromoBtn) closePromoBtn.addEventListener('click', fecharModalPromocao);
    if (cancelPromoBtn) cancelPromoBtn.addEventListener('click', fecharModalPromocao);
    if (savePromoBtn) savePromoBtn.addEventListener('click', salvarPromocao);
    if (promoModal) {
        promoModal.addEventListener('click', (e) => {
            if (e.target === promoModal) fecharModalPromocao();
        });
    }
    if (promoFileInput) {
        promoFileInput.addEventListener('change', () => {
            if (promoFileInput.files && promoFileInput.files[0]) {
                const url = URL.createObjectURL(promoFileInput.files[0]);
                promoPreviewImg.src = url;
                promoPreview.style.display = 'block';
                if (promoImageInput) promoImageInput.value = '';
            }
        });
    }
    if (promoImageInput) {
        promoImageInput.addEventListener('input', () => {
            if (promoImageInput.value.trim()) {
                promoPreviewImg.src = promoImageInput.value.trim();
                promoPreview.style.display = 'block';
                if (promoFileInput) promoFileInput.value = '';
            } else {
                promoPreview.style.display = 'none';
            }
        });
    }

    // Listeners para Combo
    const comboFileInput = document.getElementById('combo-image-file');
    const comboImageInput = document.getElementById('combo-image');
    const comboPreview = document.getElementById('combo-image-preview');
    const comboPreviewImg = document.getElementById('combo-preview-img');
    
    if (comboFileInput) {
        comboFileInput.addEventListener('change', () => {
            if (comboFileInput.files && comboFileInput.files[0]) {
                const url = URL.createObjectURL(comboFileInput.files[0]);
                comboPreviewImg.src = url;
                comboPreview.style.display = 'block';
                if (comboImageInput) comboImageInput.value = '';
            }
        });
    }
    if (comboImageInput) {
        comboImageInput.addEventListener('input', () => {
            if (comboImageInput.value.trim()) {
                comboPreviewImg.src = comboImageInput.value.trim();
                comboPreview.style.display = 'block';
                if (comboFileInput) comboFileInput.value = '';
            } else {
                comboPreview.style.display = 'none';
            }
        });
    }
    
    // Listener para atualizar preço ao digitar
    const comboPriceInput = document.getElementById('combo-price-promo');
    if (comboPriceInput) {
        comboPriceInput.addEventListener('input', atualizarPrecoCombo);
    }
    
    // Fechar modal ao clicar fora
    if (editModal) {
        editModal.addEventListener('click', (e) => {
            if (e.target === editModal) {
                fecharModalEdicao();
            }
        });
    }
    
    // Permitir salvar com Enter
    const editInputs = document.querySelectorAll('#edit-item-modal input[type="text"], #edit-item-modal input[type="number"], #edit-item-modal select, #edit-item-modal textarea');
    editInputs.forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                salvarEdicaoItem();
            }
        });
    });

    // Máscaras de telefone
    const whatsappInputs = document.querySelectorAll('#company-whatsapp, #contact-whatsapp');
    whatsappInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 11) value = value.slice(0, 11);
            
            if (value.length === 0) {
                e.target.value = '';
            } else if (value.length <= 2) {
                e.target.value = '(' + value;
            } else if (value.length <= 7) {
                e.target.value = '(' + value.slice(0, 2) + ') ' + value.slice(2);
            } else {
                e.target.value = '(' + value.slice(0, 2) + ') ' + value.slice(2, 7) + '-' + value.slice(7);
            }
        });
    });

    // Status de override (Aberto/Fechado)
    let statusOverride = null;

    function atualizarBotoesStatus() {
        const btnAuto = document.getElementById('status-auto');
        const btnAberto = document.getElementById('status-forcaAberto');
        const btnFechado = document.getElementById('status-forcaFechado');
        const statusCurrentSpan = document.getElementById('status-current');
        
        // Remove ativo de todos
        [btnAuto, btnAberto, btnFechado].forEach(btn => {
            btn.classList.remove('!bg-green-500', '!bg-red-500', '!bg-blue-500', 'text-white');
        });
        
        // Ativa o botão correto
        if (statusOverride === null) {
            btnAuto.classList.add('!bg-blue-500', 'text-white');
            statusCurrentSpan.textContent = 'Automático';
        } else if (statusOverride === true) {
            btnAberto.classList.add('!bg-green-500', 'text-white');
            statusCurrentSpan.textContent = 'Forçar Aberto';
        } else {
            btnFechado.classList.add('!bg-red-500', 'text-white');
            statusCurrentSpan.textContent = 'Forçar Fechado';
        }
    }

    document.getElementById('status-auto').addEventListener('click', () => {
        statusOverride = null;
        atualizarBotoesStatus();
    });

    document.getElementById('status-forcaAberto').addEventListener('click', () => {
        statusOverride = true;
        atualizarBotoesStatus();
    });

    document.getElementById('status-forcaFechado').addEventListener('click', () => {
        statusOverride = false;
        atualizarBotoesStatus();
    });

    // Carrega o status salvo ao inicializar
    function carregarStatusOverride() {
        const saved = localStorage.getItem('statusOverride');
        if (saved !== null) {
            statusOverride = JSON.parse(saved);
            atualizarBotoesStatus();
        }
    }

    carregarStatusOverride();

    // Modifica salvarDadosEmpresa para incluir statusOverride
    const originalSalvar = window.salvarDadosEmpresa;
    window.salvarDadosEmpresa = async function() {
        // Chama a função original
        await originalSalvar.call(this);
        
        // Salva o status override
        localStorage.setItem('statusOverride', JSON.stringify(statusOverride));
        console.log('💾 Status override salvo:', statusOverride);
    };

    // Funções para Configurações
    const bairrosConfig = {
        'Vila nova': 7.00,
        'Imperial': 10.00,
        'Vila Operária': 10.00,
        'Planalto': 10.00,
        'Novo Horizonte': 8.00,
        'Tropical Palmas': 8.00,
        'Jardim Municipal': 8.00,
        'Jardim Brasilia': 10.00,
        'Irmã Edilha': 10.00,
        'São Vicente': 8.00,
        'Praia Bela': 10.00,
        'Brigadeiro': 10.00,
        'Padre Luso': 8.00,
        'Porto Leman': 10.00,
        'Alto do Porto': 6.00,
        'Umuarama': 6.00,
        'Aeroporto': 7.00,
        'Jardim Querido': 7.00,
        'Jardim dos Ypês': 5.00,
        'Jardim América': 6.00,
        'Centro': 7.00,
        'Nova Capital': 6.00,
        'Parque Eldorado': 10.00,
        'Universitário': 5.00,
        'Alto da Colina': 10.00,
        'São Francisco': 10.00,
        'Beira Rio': 6.00,
        'Eldorado': 10.00
    };

    function renderizarTaxasBairros() {
        const container = document.getElementById('neighborhood-fees');
        if (!container) return;
        
        container.innerHTML = '';
        Object.entries(bairrosConfig).forEach(([bairro, taxa]) => {
            const div = document.createElement('div');
            div.className = 'flex items-center gap-2';
            div.innerHTML = `
                <input type="text" value="${bairro}" disabled class="flex-1 border border-gray-300 rounded px-2 py-1 text-sm bg-gray-100 text-gray-600" />
                <input type="number" class="bairro-fee-input w-20 border border-gray-300 rounded px-2 py-1 text-sm" value="${taxa}" step="0.01" min="0" data-bairro="${bairro}" />
            `;
            container.appendChild(div);
        });
    }

    window.salvarConfiguracoes = async function() {
        const pixKey = document.getElementById('config-pix-key').value.trim();
        const pixCodigo = document.getElementById('config-pix-codigo').value.trim();
        const pixName = document.getElementById('config-pix-name').value.trim();
        const mpAccessToken = document.getElementById('config-mp-access-token').value.trim();
        const whatsappNumero = document.getElementById('config-whatsapp-numero').value.trim();
        const whatsappApiKey = document.getElementById('config-whatsapp-api-key').value.trim();

        if (!pixKey || !pixCodigo || !pixName) {
            mostrarModal('aviso', 'Dados incompletos', 'Por favor, preencha a chave PIX, código (copia e cola) e o nome do titular');
            return;
        }

        // Gerar URL e instância automaticamente baseado no número
        const numeroLimpo = whatsappNumero.replace(/\D/g, '');
        const whatsappApiUrl = 'https://evolution-api.com'; // URL padrão, pode ser customizada depois
        const whatsappInstance = `padoca-${numeroLimpo}`; // Gera instância automática baseada no número

        // Coletar taxas por bairro
        const deliveryFeesByNeighborhood = {};
        document.querySelectorAll('.bairro-fee-input').forEach(input => {
            const bairro = input.dataset.bairro;
            const valor = parseFloat(input.value) || 0;
            deliveryFeesByNeighborhood[bairro] = valor;
            bairrosConfig[bairro] = valor;
        });

        const configData = {
            pixKey,
            pixCodigo,
            pixName,
            mpAccessToken,
            whatsappNumero,
            whatsappApiUrl,
            whatsappApiKey,
            whatsappInstance,
            deliveryFeesByNeighborhood,
            updatedAt: new Date().toISOString()
        };

        localStorage.setItem('siteConfig', JSON.stringify(configData));

        // Carregar dados da empresa atuais
        let companyData = null;
        try {
            const resp = await fetchTenant('/company-data');
            const json = await resp.json();
            if (json.success && json.companyData) {
                companyData = json.companyData;
            }
        } catch (error) {
            console.warn('⚠️ Tentando localStorage');
            const saved = localStorage.getItem('companyData');
            if (saved) {
                companyData = JSON.parse(saved);
            }
        }

        // Mesclar configurações com dados da empresa
        const mergedData = {
            ...(companyData || {}),
            ...configData,
            savedAt: new Date().toISOString()
        };

        localStorage.setItem('companyData', JSON.stringify(mergedData));

        try {
            const response = await fetchTenant('/company-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyData: mergedData })
            });
            const result = await response.json();
            if (result.success) {
                mostrarConfirmacao('✅ Sucesso', 'Configurações salvas com sucesso!');
            } else {
                mostrarConfirmacao('⚠️ Aviso', 'Salvou localmente, mas falhou ao sincronizar.');
            }
        } catch (error) {
            console.error('Erro ao sincronizar configurações:', error);
            mostrarConfirmacao('⚠️ Aviso', 'Configurações salvas localmente. Não foi possível sincronizar agora.');
        }

        console.log('💾 Configurações salvas:', configData);
    };

    window.carregarConfiguracoes = async function() {
        let config = null;

        try {
            const resp = await fetchTenant('/company-data');
            const json = await resp.json();
            if (json.success && json.companyData && Object.keys(json.companyData).length > 0) {
                config = json.companyData;
                console.log('✅ Configurações carregadas do servidor');
            }
        } catch (error) {
            console.warn('⚠️ Não foi possível carregar do servidor, tentando localStorage');
        }

        if (!config) {
            const saved = localStorage.getItem('companyData');
            if (saved) {
                try {
                    config = JSON.parse(saved);
                } catch (error) {
                    console.error('❌ Erro ao parsear configurações locais:', error);
                }
            }
        }

        if (!config) {
            renderizarTaxasBairros();
            return;
        }

        // Atualizar bairros com valores carregados
        if (config.deliveryFeesByNeighborhood) {
            Object.assign(bairrosConfig, config.deliveryFeesByNeighborhood);
        }

        const map = {
            'config-pix-key': config.pixKey,
            'config-pix-codigo': config.pixCodigo,
            'config-pix-name': config.pixName,
            'config-mp-access-token': config.mpAccessToken,
            'config-whatsapp-numero': config.whatsappNumero,
            'config-whatsapp-api-key': config.whatsappApiKey
        };

        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el && value !== undefined && value !== null) {
                el.value = value;
            }
        });

        renderizarTaxasBairros();
    };

    // Carrega configurações ao inicializar
    carregarConfiguracoes();
});




