let pedidos = [];
let filtroAtivo = 'todos';
let filtroPagamento = 'todos';
let filtroTipo = 'todos';
let searchTerm = '';
let autoRefreshInterval = null;
let somAtivo = false;
let autoConfirmar = false;
let ultimoPedidoIds = new Set();
let primeiraVez = true;
const AUTO_REFRESH_MS = 30000;

const MINIMIZED_KEY = 'adminMinimizedPedidos';
const getMinimizedSet = () => {
    try { return new Set(JSON.parse(localStorage.getItem(MINIMIZED_KEY) || '[]')); } catch { return new Set(); }
};
const saveMinimizedSet = (set) => {
    try { localStorage.setItem(MINIMIZED_KEY, JSON.stringify(Array.from(set))); } catch {}
};

let adminPrefs = (() => {
    try { return JSON.parse(localStorage.getItem('adminPrefs') || '{}'); } catch { return {}; }
})();

somAtivo = !!adminPrefs.somAtivo;
autoConfirmar = !!adminPrefs.autoConfirmar;

const TENANT = (() => {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    let slug = 'padoca-do-dede';
    
    if (pathParts.length > 0 && !pathParts[0].includes('.')) {
        slug = pathParts[0];
        if (slug === 'padoca-dede') {
            slug = 'padoca-do-dede';
        }
    }
    
    const searchParams = new URLSearchParams(window.location.search);
    const finalTenant = searchParams.get('tenant') || slug;
    return finalTenant;
})();
const API_BASE = `${window.location.origin}/api`;
const tenantHeaders = { 'x-tenant': TENANT };
const fetchTenant = (path, options = {}) => fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...(options.headers || {}), ...tenantHeaders }
});

async function parseJSONResponse(response) {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        const err = new Error('Erro ao fazer parse do JSON');
        err.responseText = text;
        throw err;
    }
}



function ajustarLinksTenant() {
    const back = document.getElementById('back-to-site');
    if (back) back.href = 'index.html';
}

// Função de Logout
async function fazerLogout() {
    const confirmou = await confirmar('Tem certeza que deseja sair?', 'Logout');
    if (confirmou) {
        try {
            // Limpar localStorage
            localStorage.removeItem('userSubscription');
            localStorage.removeItem('companyData');
            localStorage.removeItem('adminPrefs');
            localStorage.removeItem('abaPainelAtiva');
            localStorage.removeItem('statusOverride');
            
            // Chamar endpoint de logout do servidor para destruir sessão
            const response = await fetch('/logout');
            
            // Redirecionar para página de login
            window.location.href = '/login';
        } catch (error) {
            console.error('Erro ao fazer logout:', error);
            // Mesmo em caso de erro, tenta redirecionar
            window.location.href = '/login';
        }
    }
}

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

function mostrarModal(tipo, titulo, mensagem) {
    const modal = document.getElementById('modal-notificacao');
    const header = document.getElementById('modal-notif-header');
    const icon = document.getElementById('modal-notif-icon');
    const tituloEl = document.getElementById('modal-notif-titulo');
    const mensagemEl = document.getElementById('modal-notif-mensagem');
    const btn = document.getElementById('modal-notif-btn');
    
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

function iniciarAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(() => {
        const tab = document.getElementById('tab-pedidos');
        const visivel = tab && !tab.classList.contains('hidden');
        if (visivel) {
            carregarPedidos();
        }
    }, AUTO_REFRESH_MS);
}

function pararAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

let editingItemIndex = null;
let editingPromotionIndex = null;
let confirmationCallback = null;
let promotionMode = 'manual';
let selectedComboItems = [];
let comboFilterCategory = 'todos';
let customCategories = [];

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

const audioNovo = new Audio('/assets/fart-with-reverb.mp3');

const tabTitles = {
    'tab-dashboard': '📦 Painel Admin - Início',
    'tab-pedidos': '📋 Painel Admin - Ver pedidos',
    'tab-itens': '🍔 Painel Admin - Meus itens',
    'tab-categorias': '📚 Painel Admin - Categorias',
    'tab-pagamentos': '💳 Painel Admin - Formas de pagamento',
    'tab-config': '⚙️ Painel Admin - Configurações',
    'tab-promotions': '🎉 Painel Admin - Promoções',
    'tab-monte': '🍕 Painel Admin - Monte sua pizza',
    'tab-relatorios': '📊 Painel Admin - Relatórios'
};
function setTab(tabId, addon = null, index = -1) {
    document.querySelectorAll('.tab-section').forEach(sec => sec.classList.add('hidden'));
    const target = document.getElementById(tabId);
    if (target) target.classList.remove('hidden');

    // Atualizar botões de aba (visual)
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.dataset.tab === tabId) {
            btn.classList.add('active', 'bg-zinc-900', 'text-white');
        } else {
            btn.classList.remove('active', 'bg-zinc-900', 'text-white');
        }
    });

    // Atualizar título do header se disponível
    if (typeof tabTitles !== 'undefined' && tabTitles[tabId]) {
        const header = document.getElementById('header-title');
        if (header) header.textContent = tabTitles[tabId];
    }

    // Disparar carregamentos específicos ao abrir certas abas
    try {
        if (tabId === 'tab-pedidos') carregarPedidos();
        if (tabId === 'tab-addons') carregarAddons();
        if (tabId === 'tab-monte') renderizarMontePizzasList();
        if (tabId === 'tab-itens') renderizarCardapioEdit();
    } catch (e) {
        console.warn('Erro ao executar carregamento da aba:', e);
    }

    // Se for aba de addons e addon foi passado, abrir modal
    if (tabId === 'tab-addons' && addon) {
        const nameEl = document.getElementById('addon-name');
        const priceEl = document.getElementById('addon-price');
        const categoryEl = document.getElementById('addon-category');
        const activeEl = document.getElementById('addon-active');
        const modalEl = document.getElementById('addon-modal');

        if (nameEl) nameEl.value = addon.name || '';
        if (priceEl) priceEl.value = addon.price || '';
        if (categoryEl) categoryEl.value = (index >= 0 ? (addon.category || 'geral') : '');
        if (activeEl) activeEl.checked = addon.ativo !== false;

        if (modalEl) {
            modalEl.classList.remove('hidden');
            // garantir visibilidade
            try {
                modalEl.style.display = 'flex';
                modalEl.style.pointerEvents = '';
            } catch {}
            try {
                modalEl.style.outline = '';
                modalEl.style.backgroundColor = '';
            } catch (e) {}

            // checar ancestrais e mover para body se estiverem escondendo
            try {
                let el = modalEl.parentElement;
                const badAncestors = [];
                while (el) {
                    const c = window.getComputedStyle(el);
                    if (c.display === 'none' || c.visibility === 'hidden' || Number(c.opacity) === 0) {
                        badAncestors.push(el);
                    }
                    el = el.parentElement;
                }
                if (badAncestors.length) {
                    try {
                        if (modalEl.parentElement !== document.body) {
                            modalEl.__originalParent = modalEl.parentElement;
                            modalEl.__originalNextSibling = modalEl.nextSibling;
                            document.body.appendChild(modalEl);
                            modalEl.style.position = 'fixed';
                            modalEl.style.inset = '0';
                            modalEl.style.display = 'flex';
                        }
                    } catch (e) {}
                }
            } catch (e) {}

            try { nameEl?.focus(); } catch (e) {}
        } else {
            console.warn('addon-modal element not found');
        }
    }
    // Função que carrega os pedidos (encapsula os awaits)
    async function carregarPedidos() {
        try {
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('pedidos-container').classList.add('hidden');
        document.getElementById('empty-state').classList.add('hidden');

        const response = await fetchTenant('/pedidos');
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();

        if (result.success) {
            const anteriores = new Set(pedidos.map(p => p.id));
            pedidos = result.pedidos.sort((a, b) => new Date(b.data) - new Date(a.data));

            // Sempre renderizar e atualizar KPIs
            renderizarPedidos();
            atualizarKpis();

            // Detectar novos pedidos (sempre na primeira vez, ou se houver novos)
            let novos = [];
            if (primeiraVez) {
                // Considera todos como novos na primeira vez se houver pedidos
                if (pedidos.length > 0) {
                    novos = pedidos;
                }
            } else {
                novos = pedidos.filter(p => !anteriores.has(p.id) && anteriores.size > 0);
            }
            if (novos.length > 0) {

                if (somAtivo) {
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
}

// Definição global de carregarPedidos — garante que a chamada esteja disponível
async function carregarPedidos() {
    try {
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

// Liga eventos de UI (auto, som) após funções principais
(function inicializarControlesAdmin() {
    ajustarLinksTenant();

    const toggleAuto = document.getElementById('toggle-auto-refresh');
    const toggleSomEl = document.getElementById('toggle-som');
    const toggleAutoConfirmarEl = document.getElementById('toggle-auto-confirmar');

    // Aplicar preferências salvas aos toggles
    if (toggleAuto) toggleAuto.checked = !!adminPrefs.autoRefresh;
    if (toggleSomEl) toggleSomEl.checked = !!adminPrefs.somAtivo;
    if (toggleAutoConfirmarEl) toggleAutoConfirmarEl.checked = !!adminPrefs.autoConfirmar;

    // Ativar comportamentos automaticamente se preferências estiverem salvas
    if (toggleAuto && toggleAuto.checked) iniciarAutoRefresh();
    if (toggleSomEl && toggleSomEl.checked) somAtivo = true;
    if (toggleAutoConfirmarEl && toggleAutoConfirmarEl.checked) autoConfirmar = true;

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

function filtrarPedidos(pedidosArray = pedidos, filtroStatus = filtroAtivo, filtroPag = filtroPagamento, filtroTip = filtroTipo, search = searchTerm) {
    const filtrados = pedidosArray.filter(p => {
        const byStatus = filtroStatus === 'todos' ? true : p.status === filtroStatus;
        const termo = search.trim().toLowerCase();
        const bySearch = termo === '' ? true : (p.cliente.nome.toLowerCase().includes(termo) || (p.cliente.whatsapp || '').toLowerCase().includes(termo));
        const byPagamento = filtroPag === 'todos' ? true : (p.pagamento && p.pagamento.forma === filtroPag);
        const byTipo = filtroTip === 'todos' ? true : (p.tipoEntrega === filtroTip);
        return byStatus && bySearch && byPagamento && byTipo;
    });
    
    // Debug: Contar status de todos os pedidos
    const statusCount = {};
    pedidosArray.forEach(p => {
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

function atualizarKpis(pedidosFiltrados = null) {
    const pedidosParaCalculo = pedidosFiltrados || pedidos;
    console.log('📊 atualizarKpis() chamado. Total de pedidos:', pedidosParaCalculo.length);
    console.log('📦 Dados de pedidos:', pedidosParaCalculo);
    
    const totalDia = pedidosParaCalculo.reduce((sum, p) => sum + (p.total || 0), 0);
    const pendentes = pedidosParaCalculo.filter(p => p.status === 'pendente').length;
    const confirmados = pedidosParaCalculo.filter(p => p.status === 'confirmado').length;
    const cancelados = pedidosParaCalculo.filter(p => p.status === 'cancelado').length;
    const totalPedidos = pedidosParaCalculo.length;
    const entregues = pedidosParaCalculo.filter(p => p.status === 'entregue').length;
    const menorPedido = pedidosParaCalculo.length > 0 ? Math.min(...pedidosParaCalculo.map(p => p.total || 0)) : 0;
    const maiorPedido = pedidosParaCalculo.length > 0 ? Math.max(...pedidosParaCalculo.map(p => p.total || 0)) : 0;
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
        if (pedidosParaCalculo.length > 0) {
            const pedidoAntigo = new Date(Math.min(...pedidosParaCalculo.map(p => new Date(p.data).getTime())));
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
    // Removido: gráfico só é desenhado quando filtrado
    
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
    const hoje = new Date().toDateString();
    const pedidosHoje = pedidos.filter(p => new Date(p.data).toDateString() === hoje);
    const pedidosFiltrados = filtrarPedidos(pedidosHoje);

    console.log(`📋 Renderizando pedidos de hoje. Total hoje: ${pedidosHoje.length}, Filtrados: ${pedidosFiltrados.length}, Filtro atual: ${filtroAtivo}`);

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
                        <p class="text-sm font-semibold mt-1">Total: R$${pedido.total.toFixed(2).replace('.', ',')}</p>
                    </div>
                    <div class="flex flex-col items-end gap-2">
                        <span class="px-3 py-1 rounded-full text-sm font-semibold ${getStatusClass(pedido.status)}">
                            ${getStatusText(pedido.status)}
                        </span>
                        <span class="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">${tipoEntrega}</span>
                        <span class="px-2 py-1 rounded-full text-xs ${isPix ? (expirou ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700') : 'bg-gray-100 text-gray-700'}">
                            ${isPix ? (expirou ? 'Pix expirado' : 'Pix') : forma.toUpperCase()}
                        </span>
                        <button id="pedido-toggle-${pedido.id}" onclick="togglePedidoDetalhes('${pedido.id}')" class="px-3 py-1 border rounded text-xs hover:bg-gray-100 transition flex items-center gap-1">
                            <i class="fa fa-minus"></i> Minimizar
                        </button>
                    </div>
                </div>

                <div id="pedido-detalhes-${pedido.id}">
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
            </div>
        `;
    }).join('');

    const minimized = getMinimizedSet();
    pedidosFiltrados.forEach(pedido => {
        const detalhes = document.getElementById(`pedido-detalhes-${pedido.id}`);
        const btn = document.getElementById(`pedido-toggle-${pedido.id}`);
        if (!detalhes || !btn) return;
        if (minimized.has(String(pedido.id))) {
            detalhes.classList.add('hidden');
            btn.innerHTML = '<i class="fa fa-plus"></i> Expandir';
        }
    });
}

function togglePedidoDetalhes(pedidoId) {
    const detalhes = document.getElementById(`pedido-detalhes-${pedidoId}`);
    const btn = document.getElementById(`pedido-toggle-${pedidoId}`);
    if (!detalhes || !btn) return;
    const isHidden = detalhes.classList.contains('hidden');
    if (isHidden) {
        detalhes.classList.remove('hidden');
        btn.innerHTML = '<i class="fa fa-minus"></i> Minimizar';
        const minimized = getMinimizedSet();
        minimized.delete(String(pedidoId));
        saveMinimizedSet(minimized);
    } else {
        detalhes.classList.add('hidden');
        btn.innerHTML = '<i class="fa fa-plus"></i> Expandir';
        const minimized = getMinimizedSet();
        minimized.add(String(pedidoId));
        saveMinimizedSet(minimized);
    }
}

function minimizarTodosPedidos() {
    document.querySelectorAll('[id^="pedido-detalhes-"]').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('[id^="pedido-toggle-"]').forEach(btn => {
        btn.innerHTML = '<i class="fa fa-plus"></i> Expandir';
    });
    const minimized = new Set();
    document.querySelectorAll('[id^="pedido-detalhes-"]').forEach(el => {
        const id = el.id.replace('pedido-detalhes-', '');
        minimized.add(String(id));
    });
    saveMinimizedSet(minimized);
}

function expandirTodosPedidos() {
    document.querySelectorAll('[id^="pedido-detalhes-"]').forEach(el => el.classList.remove('hidden'));
    document.querySelectorAll('[id^="pedido-toggle-"]').forEach(btn => {
        btn.innerHTML = '<i class="fa fa-minus"></i> Minimizar';
    });
    saveMinimizedSet(new Set());
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

// ==================== MERCADO PAGO - ASSINATURA ====================

// Algoritmo de Luhn para validar número do cartão
function validarLuhn(numero) {
    numero = numero.replace(/\D/g, '');
    if (numero.length < 13 || numero.length > 19) return false;
    
    let soma = 0;
    let alternar = false;
    
    for (let i = numero.length - 1; i >= 0; i--) {
        let n = parseInt(numero.charAt(i), 10);
        
        if (alternar) {
            n *= 2;
            if (n > 9) n -= 9;
        }
        
        soma += n;
        alternar = !alternar;
    }
    
    return (soma % 10) === 0;
}

// Aplicar máscaras aos campos
function aplicarMascaras() {
    // Máscara de número do cartão (0000 0000 0000 0000)
    const cardNumber = document.getElementById('card-number');
    if (cardNumber) {
        cardNumber.addEventListener('input', function(e) {
            let valor = e.target.value.replace(/\D/g, '').substring(0, 16);
            let formatado = '';
            for (let i = 0; i < valor.length; i++) {
                if (i > 0 && i % 4 === 0) formatado += ' ';
                formatado += valor[i];
            }
            e.target.value = formatado;
        });
    }
    
    // Máscara de validade (MM/AA)
    const cardExpiry = document.getElementById('card-expiry');
    if (cardExpiry) {
        let lastValue = '';
        
        cardExpiry.addEventListener('input', function(e) {
            let currentValue = e.target.value;
            let isDeleting = currentValue.length < lastValue.length;
            
            // Se está deletando, deixar deletar sem interferência
            if (isDeleting) {
                lastValue = currentValue;
                return;
            }
            
            // Quando digitando, aplicar máscara
            let valor = currentValue.replace(/\D/g, '').substring(0, 4);
            
            if (valor.length === 0) {
                e.target.value = '';
                lastValue = '';
                return;
            }
            
            let formatado = '';
            
            if (valor.length >= 1) {
                let mes = valor.substring(0, 2);
                if (mes.length === 2) {
                    const mesNum = parseInt(mes);
                    if (mesNum > 12) {
                        mes = '12';
                    } else if (mesNum === 0) {
                        mes = '01';
                    }
                }
                formatado = mes;
            }
            
            if (valor.length >= 3) {
                formatado += '/' + valor.substring(2, 4);
            }
            
            e.target.value = formatado;
            lastValue = formatado;
        });
    }
    
    // Máscara de CVV (apenas 3-4 dígitos)
    const cardCvv = document.getElementById('card-cvv');
    if (cardCvv) {
        cardCvv.addEventListener('input', function(e) {
            e.target.value = e.target.value.replace(/\D/g, '').substring(0, 4);
        });
    }
}

// Verificar status do plano ao carregar
async function verificarStatusPlano() {
    try {
        const subscriptions = localStorage.getItem('userSubscription');
        if (subscriptions) {
            const sub = JSON.parse(subscriptions);
            
            // Mostrar plano ativo
            document.getElementById('plan-status-active').classList.remove('hidden');
            document.getElementById('plan-status-inactive').classList.add('hidden');
            document.getElementById('btn-cancelar-plano').classList.remove('hidden');
            
            // Atualizar próxima cobrança
            const nextBilling = new Date(sub.nextBilling);
            document.getElementById('next-billing').textContent = nextBilling.toLocaleDateString('pt-BR');
            
            // Desabilitar inputs
            document.getElementById('card-number').disabled = true;
            document.getElementById('card-expiry').disabled = true;
            document.getElementById('card-cvv').disabled = true;
            document.getElementById('card-holder').disabled = true;
            document.getElementById('billing-email').disabled = true;
            
            // Preencher dados
            document.getElementById('card-holder').value = sub.cardHolder || '';
            document.getElementById('billing-email').value = sub.email || '';
            
        } else {
            // Mostrar plano inativo
            document.getElementById('plan-status-inactive').classList.remove('hidden');
            document.getElementById('plan-status-active').classList.add('hidden');
            document.getElementById('btn-cancelar-plano').classList.add('hidden');
            
            // Habilitar inputs
            document.getElementById('card-number').disabled = false;
            document.getElementById('card-expiry').disabled = false;
            document.getElementById('card-cvv').disabled = false;
            document.getElementById('card-holder').disabled = false;
            document.getElementById('billing-email').disabled = false;
        }
    } catch (error) {
        console.error('Erro ao verificar plano:', error);
    }
}

// Inicializar quando o DOM carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        verificarStatusPlano();
        aplicarMascaras();
    });
} else {
    verificarStatusPlano();
    aplicarMascaras();
}

async function iniciarAssinatura() {
    const billingEmail = document.getElementById('billing-email').value.trim();
    const cardNumber = document.getElementById('card-number').value.trim().replace(/\s/g, '');
    const cardExpiry = document.getElementById('card-expiry').value.trim();
    const cardCvv = document.getElementById('card-cvv').value.trim();
    const cardHolder = document.getElementById('card-holder').value.trim().toUpperCase();
    
    // Validações
    if (!billingEmail) {
        erro('Email é obrigatório');
        document.getElementById('billing-email').focus();
        return;
    }
    
    if (!cardNumber || cardNumber.length < 13) {
        erro('Número do cartão inválido (mínimo 13 dígitos)');
        document.getElementById('card-number').focus();
        return;
    }
    
    // Validar com algoritmo de Luhn
    if (!validarLuhn(cardNumber)) {
        erro('Número do cartão inválido. Verifique os dígitos.');
        document.getElementById('card-number').focus();
        return;
    }
    
    if (!cardExpiry || cardExpiry.length !== 5 || !cardExpiry.includes('/')) {
        erro('Validade inválida (formato: MM/AA)');
        document.getElementById('card-expiry').focus();
        return;
    }
    
    // Validar se a data não está expirada
    const [mes, ano] = cardExpiry.split('/');
    const mesNum = parseInt(mes);
    const anoNum = parseInt('20' + ano);
    if (mesNum < 1 || mesNum > 12) {
        erro('Mês inválido (01-12)');
        document.getElementById('card-expiry').focus();
        return;
    }
    
    const agora = new Date();
    const dataCartao = new Date(anoNum, mesNum - 1);
    if (dataCartao < agora) {
        erro('Cartão expirado. Por favor, atualize.');
        document.getElementById('card-expiry').focus();
        return;
    }
    
    if (!cardCvv || cardCvv.length < 3 || cardCvv.length > 4) {
        erro('CVV inválido (3-4 dígitos)');
        document.getElementById('card-cvv').focus();
        return;
    }
    
    if (!cardHolder || cardHolder.length < 3) {
        erro('Nome do titular inválido');
        document.getElementById('card-holder').focus();
        return;
    }

    try {
        const btn = event.target;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Processando...';

        // Enviar dados para servidor
        const response = await fetch('/api/criar-assinatura', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: billingEmail,
                cardNumber: cardNumber,
                cardExpiry: cardExpiry,
                cardCvv: cardCvv,
                cardHolder: cardHolder
            })
        });

        const data = await response.json();

        if (data.success && data.init_point) {
            // Salvar info localmente
            localStorage.setItem('userSubscription', JSON.stringify({
                email: billingEmail,
                cardHolder: cardHolder,
                amount: 200,
                status: 'active',
                createdAt: new Date().toISOString(),
                nextBilling: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            }));
            
            // Redirecionar para Mercado Pago
            console.log('🔗 Redirecionando para:', data.init_point);
            window.location.href = data.init_point;
        } else {
            throw new Error(data.error || 'Erro ao processar assinatura');
        }
    } catch (error) {
        console.error('❌ Erro:', error);
        erro('Erro ao processar assinatura:\n\n' + error.message);
        if (event.target) {
            event.target.disabled = false;
            event.target.innerHTML = '<i class="fa fa-check"></i> Ativar Plano';
        }
    }
}

function cancelarPlano() {
    confirmar('Tem certeza que deseja CANCELAR sua assinatura?\n\nVocê perderá acesso ao painel administrativo.', 'Cancelar Assinatura').then(confirmado => {
        if (confirmado) {
            localStorage.removeItem('userSubscription');
            sucesso('Assinatura cancelada com sucesso!');
            setTimeout(() => location.reload(), 1500);
        }
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
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">R$ ${((item.preco ?? item.precoUnitario ?? 0).toFixed(2)).replace('.', ',')}</td>
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
    const confirmou = await confirmar(`Deseja remover o desconto de "${itemName}"?`, 'Remover Desconto');
    if (!confirmou) return;

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
        document.getElementById('combo-bebida-type').value = promo.bebidaType || 'nenhum';
        document.getElementById('combo-allow-adicionais').checked = promo.allowAdicionais !== false;
        
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
    
    // Adicionar seção especial para refrigerante à escolha
    const isRefriSelected = selectedComboItems.some(sItem => sItem.name === 'Refrigerante a sua escolha');
    html += `
        <div class="space-y-2">
            <div class="sticky top-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-3 py-2 rounded-lg font-bold text-sm shadow-md z-10">
                <i class="fa fa-glass-whiskey mr-2"></i>Opções Especiais
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                <label class="flex flex-col items-center gap-2 p-2 border-2 rounded-lg cursor-pointer transition-all ${isRefriSelected ? 'bg-blue-50 border-blue-500 shadow-lg scale-105' : 'border-gray-200 hover:border-blue-400 hover:shadow-md'}">
                    <input type="checkbox" 
                           ${isRefriSelected ? 'checked' : ''} 
                           onchange="toggleComboItem({name: 'Refrigerante a sua escolha', price: 0, image: './assets/default.jpg'}, this.checked); event.stopPropagation();"
                           class="w-5 h-5 rounded cursor-pointer accent-blue-500" />
                    <div class="w-full h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded flex items-center justify-center">
                        <i class="fa fa-glass-whiskey text-blue-600 text-2xl"></i>
                    </div>
                    <div class="text-center w-full px-1">
                        <div class="font-semibold text-gray-800 text-xs leading-tight mb-1">Refrigerante a sua escolha</div>
                        <div class="text-xs text-blue-600 font-bold">Grátis</div>
                    </div>
                </label>
            </div>
        </div>
    `;
    
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

    const bebidaType = document.getElementById('combo-bebida-type').value;
    const allowAdicionais = document.getElementById('combo-allow-adicionais').checked;

    const promo = { 
        name, 
        description, 
        priceOriginal, 
        pricePromo, 
        image, 
        ativo,
        items: selectedComboItems,
        type: 'combo',
        bebidaType,
        allowAdicionais
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
    const activeEl = document.getElementById('edit-item-active');
    if (activeEl) activeEl.checked = item.ativo;
    const drinkTypeEl = document.getElementById('edit-item-drink-type');
    if (drinkTypeEl) drinkTypeEl.value = item.drinkType || 'nenhum';
    const allowAddonsEl = document.getElementById('edit-item-allow-addons');
    if (allowAddonsEl) allowAddonsEl.checked = item.allowAddons !== false;
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
    const activeEl = document.getElementById('edit-item-active');
    if (activeEl) activeEl.checked = true;
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
    const ativoEl = document.getElementById('edit-item-active');
    const drinkTypeEl = document.getElementById('edit-item-drink-type');
    const allowAddonsEl = document.getElementById('edit-item-allow-addons');
    const ativo = ativoEl ? ativoEl.checked : (editingItemIndex === null ? true : menu[editingItemIndex].ativo);
    const drinkType = drinkTypeEl ? drinkTypeEl.value : (editingItemIndex === null ? 'nenhum' : menu[editingItemIndex].drinkType || 'nenhum');
    const allowAddons = allowAddonsEl ? allowAddonsEl.checked : (editingItemIndex === null ? true : menu[editingItemIndex].allowAddons !== false);
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
            ativo: ativo,
            drinkType: drinkType,
            allowAddons: allowAddons
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
        menu[editingItemIndex].drinkType = drinkType;
        menu[editingItemIndex].allowAddons = allowAddons;
        mostrarConfirmacao('✅ Sucesso', 'Item atualizado com sucesso!');
    }
    
    renderizarCardapioEdit();
    renderizarCardapioView();
    renderizarMontePizzasList();
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

function obterOrdemCategorias() {
    const order = [];
    const seen = new Set();

    (customCategories || []).forEach(cat => {
        if (cat.key && !seen.has(cat.key)) {
            order.push(cat.key);
            seen.add(cat.key);
        }
    });

    Object.keys(categoriasPadrao).forEach(key => {
        if (!seen.has(key)) {
            order.push(key);
            seen.add(key);
        }
    });

    (menu || []).forEach(item => {
        const key = item.category;
        if (key && !seen.has(key)) {
            order.push(key);
            seen.add(key);
        }
    });

    return order;
}

function obterCategoriasGerenciadas() {
    const merged = { ...categoriasPadrao };
    customCategories.forEach(cat => {
        merged[cat.key] = { emoji: cat.emoji || '📦', nome: cat.nome };
    });
    const allItems = menu || [];
    allItems.forEach(item => {
        const key = item.category;
        if (key && !merged[key]) {
            merged[key] = { emoji: '📦', nome: getCategoryName(key) };
        }
    });

    const order = obterOrdemCategorias();
    return order
        .filter(key => merged[key])
        .map(key => ({ key, nome: merged[key].nome, emoji: merged[key].emoji || '📦' }));
}

function atualizarSelectCategorias() {
    const select = document.getElementById('edit-item-category');
    if (!select) return;

    const categorias = obterCategoriasGerenciadas();
    const selectedValue = select.value;

    select.innerHTML = categorias.map(cat =>
        `<option value="${cat.key}">${cat.emoji} ${cat.nome}</option>`
    ).join('');

    if (selectedValue) {
        select.value = selectedValue;
    }

    // Também popular o select de categoria do modal de adicionais (addon-category)
    try {
        const addonSelect = document.getElementById('addon-category');
        if (addonSelect) {
            const addonSelected = addonSelect.value;
            const opts = categorias.map(cat => `<option value="${cat.key}">${cat.nome}</option>`);
            // manter placeholder para forçar seleção explícita
            addonSelect.innerHTML = '<option value="" disabled selected>Escolha uma categoria</option>' + opts.join('');
            if (addonSelected) {
                addonSelect.value = addonSelected;
            }
        }
    } catch (e) {
        console.warn('Erro ao popular addon-category:', e);
    }
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

    const orderedKeys = obterOrdemCategorias();
    orderedKeys.forEach(key => {
        const isPadrao = !!categoriasPadrao[key];
        const cat = merged[key] || { nome: key, emoji: '📦' };
        linhas.push(criarLinhaCategoria(key, cat.nome, cat.emoji || '📦', false, {
            keyLocked: isPadrao,
            deletable: !isPadrao,
            badgeText: isPadrao ? 'padrão' : ''
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
            <button class="text-gray-600 hover:text-gray-800 px-2" data-action="move-up" title="Mover para cima"><i class="fa fa-arrow-up"></i></button>
            <button class="text-gray-600 hover:text-gray-800 px-2" data-action="move-down" title="Mover para baixo"><i class="fa fa-arrow-down"></i></button>
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
    const catMap = new Map();
    const order = [];

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
        if (catMap.has(key)) {
            const prevIndex = order.indexOf(key);
            if (prevIndex >= 0) order.splice(prevIndex, 1);
        }
        catMap.set(key, { key, nome, emoji: emoji || '📦' });
        order.push(key);
    }

    // Guardar todas as categorias (inclusive overrides das padrão) como customCategories
    customCategories = order.map(key => catMap.get(key));

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

    // Verificar se há parâmetro de aba na URL
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam) {
      // Remover parâmetro da URL para não ficar feio
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Abrir a aba solicitada
      setTimeout(() => {
        const tabBtn = document.querySelector(`[data-tab="tab-${tabParam}"]`);
        if (tabBtn) {
          tabBtn.click();
          console.log(`✅ Abrindo aba: ${tabParam}`);
        }
      }, 500);
    }

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
            renderizarMontePizzasList();
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

    const monteFilterSelect = document.getElementById('monte-filter-select');
    if (monteFilterSelect) {
        monteFilterSelect.addEventListener('change', () => renderizarMontePizzasList());
    }

    const minimizeAllBtn = document.getElementById('minimize-all-orders');
    if (minimizeAllBtn) minimizeAllBtn.addEventListener('click', minimizarTodosPedidos);
    const expandAllBtn = document.getElementById('expand-all-orders');
    if (expandAllBtn) expandAllBtn.addEventListener('click', expandirTodosPedidos);

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            localStorage.setItem('abaPainelAtiva', btn.dataset.tab);
            setTab(btn.dataset.tab);
        });
    });

    // Restaurar aba ativa ao carregar
    const abaSalva = localStorage.getItem('abaPainelAtiva');
    if (abaSalva) {
        setTab(abaSalva);
    }

    // Botão de limpar/resetar filtro nos relatórios
    const btnResetarDatas = document.getElementById('btn-resetar-datas');
    if (btnResetarDatas) {
        btnResetarDatas.addEventListener('click', () => {
            document.getElementById('data-inicio-relatorio').value = '';
            document.getElementById('data-fim-relatorio').value = '';
            console.log('🔄 Filtro de datas resetado');
            // Aplicar filtro para hoje
            const hoje = new Date().toISOString().split('T')[0];
            document.getElementById('data-inicio-relatorio').value = hoje;
            document.getElementById('data-fim-relatorio').value = hoje;
            atualizarRelatoriosPorData(hoje, hoje);
            
            const totalPedidos = pedidos.length;
            const totalFaturamento = pedidos.reduce((sum, p) => sum + (p.total || 0), 0);
            
            abrirModalFiltro('limpar', {
                totalPedidos: totalPedidos,
                faturamento: totalFaturamento
            });
        });
    }

    // Filtro por data nos relatórios
    function atualizarRelatoriosPorData(dataInicio, dataFim) {
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
    }

    const btnFiltrarDatas = document.getElementById('btn-filtrar-datas');
    if (btnFiltrarDatas) {
        btnFiltrarDatas.addEventListener('click', () => {
            const dataInicio = document.getElementById('data-inicio-relatorio').value;
            const dataFim = document.getElementById('data-fim-relatorio').value;
            
            if (!dataInicio || !dataFim) {
                mostrarModal('aviso', 'Intervalo incompleto', 'Por favor, selecione uma data de início e uma data de fim.');
                return;
            }
            
            atualizarRelatoriosPorData(dataInicio, dataFim);
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
            iniciarAutoRefresh();
        } else {
            console.log('✅ Auto-refresh desabilitado');
            pararAutoRefresh();
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
            const deleteBtn = e.target.closest('[data-action="delete"]');
            if (deleteBtn) {
                const row = deleteBtn.closest('[data-row]');
                if (row) row.remove();
                return;
            }

            const moveUpBtn = e.target.closest('[data-action="move-up"]');
            if (moveUpBtn) {
                const row = moveUpBtn.closest('[data-row]');
                if (!row) return;
                const prev = row.previousElementSibling;
                if (prev) categoriesList.insertBefore(row, prev);
                return;
            }

            const moveDownBtn = e.target.closest('[data-action="move-down"]');
            if (moveDownBtn) {
                const row = moveDownBtn.closest('[data-row]');
                if (!row) return;
                const next = row.nextElementSibling;
                if (next) categoriesList.insertBefore(next, row);
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

// ==================== WHATSAPP ====================

let whatsappCheckInterval = null;

async function verificarStatusWhatsApp() {
    try {
        const response = await fetch('/whatsapp/status');
        const data = await response.json();
        
        const statusText = document.getElementById('status-text');
        const connectedNumber = document.getElementById('connected-number');
        const companyNumber = document.getElementById('company-number');
        const lastSync = document.getElementById('last-sync');
        const qrSection = document.getElementById('qr-section');
        const connectedSection = document.getElementById('connected-section');
        const errorSection = document.getElementById('error-section');
        const statusBadge = document.getElementById('whatsapp-status-badge');
        
        // Atualizar hora de sincronização
        const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        lastSync.textContent = now;
        
        if (data.connected) {
            statusText.innerHTML = '<span class="text-green-600">🟢 Conectado</span>';
            connectedNumber.textContent = data.number || '-';
            statusBadge.innerHTML = '<i class="fas fa-circle mr-2" style="color: #22c55e; animation: pulse 2s infinite;"></i> Conectado';
            statusBadge.className = 'px-4 py-2 rounded-full font-semibold text-white bg-green-500';
            
            connectedSection.classList.remove('hidden');
            qrSection.classList.add('hidden');
            errorSection.classList.add('hidden');
            
            sucesso('WhatsApp conectado com sucesso!');
        } else if (data.status === 'qr_ready') {
            statusText.innerHTML = '<span class="text-yellow-600">🟡 Aguardando Conexão</span>';
            connectedNumber.textContent = '-';
            statusBadge.innerHTML = '<i class="fas fa-circle mr-2" style="color: #eab308; animation: pulse 2s infinite;"></i> Aguardando QR';
            statusBadge.className = 'px-4 py-2 rounded-full font-semibold text-white bg-yellow-500';
            
            qrSection.classList.remove('hidden');
            connectedSection.classList.add('hidden');
            errorSection.classList.add('hidden');
            
            // Exibir QR code se tiver dados (já é base64 do servidor)
            if (data.qr) {
                const qrContainer = document.getElementById('qr-code');
                qrContainer.innerHTML = '<img src="' + data.qr + '" alt="QR Code WhatsApp" style="width: 300px; height: 300px; image-rendering: crisp-edges;">';
            }
        } else {
            statusText.innerHTML = '<span class="text-red-600">🔴 Desconectado</span>';
            connectedNumber.textContent = '-';
            statusBadge.innerHTML = '<i class="fas fa-circle mr-2" style="color: #ef4444; animation: pulse 2s infinite;"></i> Desconectado';
            statusBadge.className = 'px-4 py-2 rounded-full font-semibold text-white bg-red-500';
            
            qrSection.classList.add('hidden');
            connectedSection.classList.add('hidden');
            errorSection.classList.add('hidden');
        }
        
        // Carregar número da empresa
        const companyData = await carregarDadosEmpresaLocal();
        if (companyData && companyData.companyWhatsapp) {
            companyNumber.textContent = companyData.companyWhatsapp;
        } else {
            companyNumber.textContent = 'Não configurado';
        }
        
    } catch (error) {
        console.error('Erro ao verificar status WhatsApp:', error);
        document.getElementById('status-text').innerHTML = '<span class="text-red-600">Erro ao verificar</span>';
        document.getElementById('error-section').classList.remove('hidden');
        document.getElementById('error-message').textContent = 'Falha na comunicação com o servidor: ' + error.message;
    }
}

// Iniciar nova conexão
async function iniciarNovaConexao() {
    try {
        erro('Recarregando página para reiniciar...');
        setTimeout(() => location.reload(), 1500);
    } catch (error) {
        console.error('Erro:', error);
    }
}

async function carregarStatusWhatsApp() {
    await verificarStatusWhatsApp();
    
    // Iniciar verificação automática a cada 10 segundos
    if (!whatsappCheckInterval) {
        whatsappCheckInterval = setInterval(verificarStatusWhatsApp, 10000);
    }
}

async function carregarDadosEmpresaLocal() {
    try {
        const data = localStorage.getItem('companyData');
        return data ? JSON.parse(data) : null;
    } catch {
        return null;
    }
}

// Carregar status WhatsApp quando abrir a aba
document.addEventListener('click', (e) => {
    if (e.target.closest('[data-tab="tab-whatsapp"]')) {
        setTimeout(carregarStatusWhatsApp, 500);
    }
});

// Desconectar WhatsApp
document.getElementById('disconnect-whatsapp')?.addEventListener('click', async () => {
    const confirmou = await confirmar('Tem certeza que deseja desconectar o WhatsApp?', 'Desconectar WhatsApp');
    if (confirmou) {
        try {
            await fetch('/whatsapp/disconnect', { method: 'POST' });
            sucesso('WhatsApp desconectado! Recarregando...');
            setTimeout(() => {
                if (whatsappCheckInterval) clearInterval(whatsappCheckInterval);
                verificarStatusWhatsApp();
            }, 1500);
        } catch (error) {
            erro('Erro ao desconectar WhatsApp: ' + error.message);
        }
    }
});

// ===== IMPRESSORA MANAGEMENT =====

// Carregar configuração de impressora
async function carregarConfigImpressora() {
    try {
        // Carregar lista de impressoras disponíveis
        try {
            const printerResponse = await fetch('/api/printer/list');
            const printers = await printerResponse.json();
            
            console.log('[Impressora] Impressoras carregadas:', printers);
            
            // Popular dropdown com impressoras reais do sistema
            const select = document.getElementById('printer-selection');
            select.innerHTML = '';
            
            if (!Array.isArray(printers) || printers.length === 0) {
                select.innerHTML = '<option value="">Nenhuma impressora encontrada</option>';
                select.disabled = true;
            } else {
                select.innerHTML = '<option value="">-- Selecione uma impressora --</option>';
                printers.forEach(printer => {
                    if (printer && printer.id) {
                        const option = document.createElement('option');
                        option.value = printer.id;
                        option.textContent = printer.name || printer.id;
                        select.appendChild(option);
                    }
                });
                select.disabled = false;
            }
        } catch (err) {
            console.error('[Impressora] Erro ao buscar lista de impressoras:', err);
            document.getElementById('printer-selection').innerHTML = '<option value="">Erro ao carregar impressoras</option>';
        }
        
        // Carregar configuração atual
        const response = await fetch('/api/printer/config');
        const config = await response.json();
        
        console.log('[Impressora] Config carregada:', config);
        
        // Atualizar UI
        document.getElementById('printer-enabled').checked = config.enabled || false;
        document.getElementById('printer-selection').value = config.selectedPrinter || '';
        document.getElementById('printer-autoprint').checked = config.autoprint || false;
        
        // Atualizar status
        atualizarStatusImpressora(config.enabled);
        
        // Habilitar/desabilitar controles
        document.getElementById('printer-selection').disabled = !config.enabled;
        document.getElementById('printer-autoprint').disabled = !config.enabled;
        
    } catch (error) {
        console.error('[Impressora] Erro ao carregar config impressora:', error);
        document.getElementById('printer-selection').innerHTML = '<option value="">Erro ao carregar configuração</option>';
    }
}

// Atualizar status visual da impressora
function atualizarStatusImpressora(habilitada) {
    const statusEl = document.getElementById('printer-status');
    const statusTextEl = document.getElementById('printer-status-text');
    
    if (habilitada) {
        statusEl.innerHTML = '<i class="fa fa-circle" style="color: #10b981;"></i> Habilitada';
        statusEl.className = 'px-3 py-1 rounded-full text-sm font-semibold bg-green-200 text-green-800';
        statusTextEl.textContent = 'habilitada';
    } else {
        statusEl.innerHTML = '<i class="fa fa-circle" style="color: #999;"></i> Desabilitada';
        statusEl.className = 'px-3 py-1 rounded-full text-sm font-semibold bg-gray-200 text-gray-800';
        statusTextEl.textContent = 'desabilitada';
    }
}

// Salvar configuração de impressora
async function salvarConfigImpressora() {
    try {
        const config = {
            enabled: document.getElementById('printer-enabled').checked,
            selectedPrinter: document.getElementById('printer-selection').value,
            autoprint: document.getElementById('printer-autoprint').checked
        };
        
        const response = await fetch('/api/printer/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        
        const result = await response.json();
        
        if (result.success) {
            sucesso('Configuração de impressora salva com sucesso!');
            atualizarStatusImpressora(config.enabled);
            
            // Atualizar estado dos controles
            document.getElementById('printer-selection').disabled = !config.enabled;
            document.getElementById('printer-autoprint').disabled = !config.enabled;
        } else {
            erro('Erro ao salvar configuração: ' + result.error);
        }
    } catch (error) {
        erro('Erro ao salvar configuração: ' + error.message);
    }
}

// Event Listeners para Impressora
document.addEventListener('click', (e) => {
    if (e.target.closest('[data-tab="tab-impressora"]')) {
        setTimeout(carregarConfigImpressora, 300);
    }
});

document.getElementById('printer-enabled')?.addEventListener('change', function() {
    const desabilitado = !this.checked;
    document.getElementById('printer-selection').disabled = desabilitado;
    document.getElementById('printer-autoprint').disabled = desabilitado;
});

document.getElementById('printer-save-btn')?.addEventListener('click', salvarConfigImpressora);

// ===== ADICIONAIS MANAGEMENT =====
let addons = [];
let editingAddonIndex = -1;

async function carregarAddons() {
    try {
        const response = await fetchTenant('/addons');
        const data = await parseJSONResponse(response);
        if (data.success && Array.isArray(data.addons)) {
            addons = data.addons;
            console.log('✅ Adicionais carregados do servidor');
            renderizarAddonsList();
        }
    } catch (error) {
        console.warn('⚠️ Não foi possível carregar adicionais do servidor:', error);
        // Fallback para dados hardcoded se não conseguir carregar
        addons = [
            { name: "Burger de gado", price: 8.00, category: "burgers", ativo: true },
            { name: "Burger de porco", price: 8.00, category: "burgers", ativo: true },
            { name: "Bacon", price: 5.00, category: "burgers", ativo: true },
            { name: "Cheddar", price: 4.00, category: "burgers", ativo: true },
            { name: "Mussarela", price: 3.00, category: "burgers", ativo: true },
            { name: "Cebola caramelizada", price: 3.00, category: "burgers", ativo: true },
            { name: "Tomate", price: 2.00, category: "geral", ativo: true },
            { name: "Alface", price: 2.00, category: "geral", ativo: true },
            { name: "Cebola roxa", price: 2.00, category: "geral", ativo: true },
            { name: "Requeijão", price: 6.00, category: "pizzas", ativo: true },
            { name: "Calabresa", price: 7.00, category: "pizzas", ativo: true },
            { name: "Frango", price: 6.00, category: "pizzas", ativo: true }
        ];
        renderizarAddonsList();
    }
}

function renderizarAddonsList() {
    const container = document.getElementById('addons-list');
    if (!container) return;
    
    if (addons.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm">Nenhum adicional cadastrado.</p>';
        return;
    }
    // Agrupar por categoria (normalizando nomes semelhantes)
    const normalize = (s) => (s || 'geral').toString().toLowerCase().trim();
    const grouped = {};
    addons.forEach((addon, idx) => {
        const keyRaw = normalize(addon.category);
        let key = keyRaw;
        if (key === 'burgers' || key === 'burger') key = 'burguers';
        if (!grouped[key]) grouped[key] = { key, display: addon.category || 'geral', items: [] };
        grouped[key].items.push({ addon, idx });
    });

    const categories = Object.values(grouped);

    let html = '';
    // filtro de categorias
    html += '<div class="mb-3 flex items-center gap-3"><label class="text-sm font-medium">Filtrar por categoria:</label><select id="addon-filter-select" class="border rounded px-2 py-1"><option value="all">Todos</option>';
    categories.forEach(c => {
        html += `<option value="${c.key}">${c.display}</option>`;
    });
    html += '</select></div>';

    // listar por categoria
    categories.forEach(c => {
        html += `<div class="group-wrapper mb-4" data-cat="${c.key}">`;
        html += `<h3 class="font-bold text-lg mb-2">${c.display}</h3>`;
        html += '<div class="space-y-3">';
        c.items.forEach(({ addon, idx }) => {
            const ativo = addon.ativo !== false;
            html += `
            <div class="bg-white rounded-lg shadow-lg overflow-hidden transition hover:shadow-xl ${!ativo ? 'opacity-60' : ''}">
                <div class="p-4">
                    <div class="flex items-center justify-between mb-2">
                        <h4 class="font-bold text-lg">${addon.name || 'Sem nome'}</h4>
                        <span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">${addon.category || 'geral'}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="font-bold text-green-600">R$ ${Number(addon.price || 0).toFixed(2).replace('.', ',')}</span>
                        ${ativo ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">ATIVO</span>' : '<span class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">INATIVO</span>'}
                    </div>
                </div>
                <div class="border-t px-3 py-2 bg-gray-50 grid grid-cols-3 gap-2">
                    <button onclick="abrirModalAddon(${idx}); event.stopPropagation();" class="bg-blue-600 text-white font-semibold py-2 rounded text-sm flex items-center justify-center gap-2 hover:opacity-90 transition">
                        <i class="fa fa-edit"></i> Editar
                    </button>
                    <button onclick="toggleAddonAtivo(${idx}); event.stopPropagation();" class="${ativo ? 'bg-orange-500' : 'bg-green-600'} text-white font-semibold py-2 rounded text-sm flex items-center justify-center gap-2 hover:opacity-90 transition" title="${ativo ? 'Desabilitar' : 'Habilitar'}">
                        <i class="fa fa-${ativo ? 'eye-slash' : 'eye'}"></i> ${ativo ? 'Desab.' : 'Hab.'}
                    </button>
                    <button onclick="deletarAddon(${idx}); event.stopPropagation();" class="bg-red-600 text-white font-semibold py-2 rounded text-sm flex items-center justify-center gap-2 hover:opacity-90 transition" title="Deletar">
                        <i class="fa fa-trash"></i> Del.
                    </button>
                </div>
            </div>
            `;
        });
        html += '</div></div>';
    });

    container.innerHTML = html;

    // aplicar listener do filtro
    const select = document.getElementById('addon-filter-select');
    if (select) {
        select.addEventListener('change', (e) => {
            const val = e.target.value;
            document.querySelectorAll('#addons-list .group-wrapper').forEach(g => {
                if (val === 'all' || g.dataset.cat === val) g.style.display = '';
                else g.style.display = 'none';
            });
        });
    }
}

function renderizarMontePizzasList() {
    const container = document.getElementById('monte-pizzas-list');
    if (!container) return;

    const filtroSelect = document.getElementById('monte-filter-select');
    const filtro = filtroSelect ? filtroSelect.value : 'all';

    const pizzasList = (menu || []).map((item, idx) => ({ item, idx }))
        .filter(({ item }) => (item.category || '').toString().toLowerCase().includes('pizz'))
        .filter(({ item }) => {
            if (filtro === 'all') return true;
            const nome = (item.name || '').toString().toLowerCase();
            if (filtro === '8') return nome.includes('8 peda');
            if (filtro === '4') return nome.includes('4 peda');
            return true;
        });

    if (pizzasList.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm">Nenhuma pizza cadastrada.</p>';
        return;
    }

    let html = '';
    pizzasList.forEach(({ item, idx }) => {
        const ativoMonte = item.monteEnabled !== false;
        html += `
        <div class="bg-white rounded-lg shadow-lg overflow-hidden transition hover:shadow-xl ${!ativoMonte ? 'opacity-60' : ''}">
            <div class="p-4">
                <div class="flex items-center justify-between mb-2">
                    <h4 class="font-bold text-lg">${item.name || 'Sem nome'}</h4>
                    <span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Pizza</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="font-bold text-green-600">R$ ${Number(item.price || 0).toFixed(2).replace('.', ',')}</span>
                    ${ativoMonte ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">NO MONTE</span>' : '<span class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">OCULTO</span>'}
                </div>
            </div>
            <div class="border-t px-3 py-2 bg-gray-50 grid grid-cols-3 gap-2">
                <button onclick="abrirModalEdicao(${idx}); event.stopPropagation();" class="bg-blue-600 text-white font-semibold py-2 rounded text-sm flex items-center justify-center gap-2 hover:opacity-90 transition">
                    <i class="fa fa-edit"></i> Editar
                </button>
                <button onclick="toggleMontePizza(${idx}); event.stopPropagation();" class="${ativoMonte ? 'bg-orange-500' : 'bg-green-600'} text-white font-semibold py-2 rounded text-sm flex items-center justify-center gap-2 hover:opacity-90 transition" title="${ativoMonte ? 'Ocultar no Monte' : 'Mostrar no Monte'}">
                    <i class="fa fa-${ativoMonte ? 'eye-slash' : 'eye'}"></i> ${ativoMonte ? 'Ocultar' : 'Mostrar'}
                </button>
                <button onclick="deletarItem(${idx}); event.stopPropagation();" class="bg-red-600 text-white font-semibold py-2 rounded text-sm flex items-center justify-center gap-2 hover:opacity-90 transition" title="Deletar">
                    <i class="fa fa-trash"></i> Del.
                </button>
            </div>
        </div>
        `;
    });

    container.innerHTML = html;
}

function toggleMontePizza(index) {
    if (!menu[index]) return;
    menu[index].monteEnabled = !(menu[index].monteEnabled !== false);
    renderizarMontePizzasList();
    sincronizarCardapio();
}

function abrirModalNovoSaborMonte() {
    abrirModalNovoItem();
    const categoryEl = document.getElementById('edit-item-category');
    if (categoryEl) categoryEl.value = 'pizzas';
}

function popularCategoriasAdicionais(selectElement, selectedCategory = '') {
    if (!selectElement) return;

    const categoriasArray = obterCategoriasGerenciadas();
    const extraAddonsCats = [
        { key: 'sabores', nome: 'Sabores (Monte)' },
        { key: 'bolinhos', nome: 'Bolinhos (Monte)' }
    ];

    // Limpar select e adicionar opção padrão
    selectElement.innerHTML = '<option value="" disabled selected>Escolha uma categoria</option>';

    // Adicionar categorias dinâmicas (inclui customizadas e padrão)
    categoriasArray.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.key;
        option.textContent = cat.nome;
        if (selectedCategory && cat.key === selectedCategory) {
            option.selected = true;
        }
        selectElement.appendChild(option);
    });

    // Adicionar categorias específicas de adicionais do Monte sua pizza
    extraAddonsCats.forEach(cat => {
        if ([...selectElement.options].some(o => o.value === cat.key)) return;
        const option = document.createElement('option');
        option.value = cat.key;
        option.textContent = cat.nome;
        if (selectedCategory && cat.key === selectedCategory) {
            option.selected = true;
        }
        selectElement.appendChild(option);
    });

    // Se não houver categoria selecionada, selecionar o placeholder
    if (!selectedCategory) {
        selectElement.selectedIndex = 0;
    }
}

function abrirModalAddon(index = -1) {
    editingAddonIndex = index;
    const addon = addons[index] || {};
    console.log('abrirModalAddon called, index=', index, 'addon=', addon);

    const nameEl = document.getElementById('addon-name');
    const priceEl = document.getElementById('addon-price');
    const categoryEl = document.getElementById('addon-category');
    const activeEl = document.getElementById('addon-active');
    const modalEl = document.getElementById('addon-modal');

    // Popular categorias dinamicamente
    popularCategoriasAdicionais(categoryEl, addon.category);

    if (nameEl) nameEl.value = addon.name || '';
    if (priceEl) priceEl.value = addon.price || '';
    if (activeEl) activeEl.checked = addon.ativo !== false;

    if (modalEl) {
        modalEl.classList.remove('hidden');
        // garantir visibilidade caso algum estilo inline esteja ocultando
        try {
            modalEl.style.display = 'flex';
            modalEl.style.zIndex = '9999';
            modalEl.style.opacity = '1';
            modalEl.style.pointerEvents = 'auto';
        } catch (e) {
            console.warn('erro ao aplicar estilos inline no modal', e);
        }
        // log do estilo computado para diagnóstico
        try {
            const cs = window.getComputedStyle(modalEl);
            const csInfo = { display: cs.display, visibility: cs.visibility, opacity: cs.opacity, zIndex: cs.zIndex, pointerEvents: cs.pointerEvents };
            console.log('addon-modal computedStyle:', csInfo);
            // bounding rect
            try {
                const r = modalEl.getBoundingClientRect();
                const rectInfo = { top: r.top, left: r.left, width: r.width, height: r.height };
                console.log('addon-modal boundingRect:', rectInfo);
            } catch (e) {
                console.warn('erro ao obter boundingRect do modal', e);
            }
            // destacar visualmente para confirmar presença
            try {
                modalEl.style.outline = '4px solid rgba(255,0,0,0.9)';
                modalEl.style.backgroundColor = 'rgba(255,0,0,0.04)';
            } catch (e) {
                console.warn('erro ao aplicar destaque visual no modal', e);
            }
            // verificar ancestrais com display/visibility problemáticos
            try {
                let el = modalEl.parentElement;
                const badAncestors = [];
                while (el) {
                    const c = window.getComputedStyle(el);
                    if (c.display === 'none' || c.visibility === 'hidden' || Number(c.opacity) === 0) {
                        badAncestors.push({ tag: el.tagName, id: el.id || null, class: el.className || null, display: c.display, visibility: c.visibility, opacity: c.opacity });
                    }
                    el = el.parentElement;
                }
                if (badAncestors.length) {
                    console.warn('ancestors with hiding styles:', JSON.parse(JSON.stringify(badAncestors)));
                    // Se existirem ancestrais que escondem o modal, mova o modal temporariamente para body
                    try {
                        if (modalEl.parentElement !== document.body) {
                            modalEl.__originalParent = modalEl.parentElement;
                            modalEl.__originalNextSibling = modalEl.nextSibling;
                            document.body.appendChild(modalEl);
                            console.log('addon-modal movido para document.body temporariamente para garantir visibilidade');
                            // reforçar estilos para exibir corretamente
                            modalEl.style.position = 'fixed';
                            modalEl.style.inset = '0';
                            modalEl.style.display = 'flex';
                        }
                    } catch (e) {
                        console.warn('erro ao mover modal para body', e);
                    }
                }
            } catch (e) {
                console.warn('erro ao inspecionar ancestrais do modal', e);
            }
        } catch (e) {
            console.warn('erro ao obter computedStyle do modal', e);
        }
        // tentar focar o primeiro input para trazer atenção
        try { document.getElementById('addon-name')?.focus(); } catch (e) {}
    } else {
        console.warn('addon-modal element not found');
    }
}

function fecharModalAddon() {
    const modalEl = document.getElementById('addon-modal');
    if (modalEl) {
        // restaurar posição original se foi movido
        try {
            if (modalEl.__originalParent) {
                if (modalEl.__originalNextSibling && modalEl.__originalNextSibling.parentElement === modalEl.__originalParent) {
                    modalEl.__originalParent.insertBefore(modalEl, modalEl.__originalNextSibling);
                } else {
                    modalEl.__originalParent.appendChild(modalEl);
                }
                delete modalEl.__originalParent;
                delete modalEl.__originalNextSibling;
            }
        } catch (e) {}

        modalEl.classList.add('hidden');
        try {
            modalEl.style.display = 'none';
            modalEl.style.zIndex = '';
            modalEl.style.opacity = '';
            modalEl.style.pointerEvents = '';
            modalEl.style.outline = '';
            modalEl.style.backgroundColor = '';
            modalEl.style.position = '';
            modalEl.style.inset = '';
        } catch (e) {}
    }
    editingAddonIndex = -1;
}

async function salvarAddon() {
    const name = document.getElementById('addon-name').value.trim();
    const price = parseFloat(document.getElementById('addon-price').value) || 0;
    const category = document.getElementById('addon-category').value;
    const ativo = document.getElementById('addon-active').checked;
    
    if (!name) {
        mostrarConfirmacao('❌ Erro', 'Nome do adicional é obrigatório!');
        return;
    }
    if (!category) {
        mostrarConfirmacao('❌ Erro', 'Categoria é obrigatória!');
        return;
    }
    
    const addonData = { name, price, category, ativo };
    
    try {
        if (editingAddonIndex >= 0) {
            // Editar existente
            const response = await fetchTenant(`/addons/${encodeURIComponent(addons[editingAddonIndex].name)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(addonData)
            });
            const data = await parseJSONResponse(response);
            if (data.success) {
                addons[editingAddonIndex] = addonData;
                mostrarConfirmacao('✅ Sucesso', 'Adicional atualizado!');
                try { localStorage.setItem('addons-updated', new Date().toISOString()); } catch(e){}
            } else {
                throw new Error(data.message || 'Erro ao atualizar adicional');
            }
        } else {
            // Criar novo
            const response = await fetchTenant('/addons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(addonData)
            });
            const data = await parseJSONResponse(response);
            if (data.success) {
                addons.push(addonData);
                mostrarConfirmacao('✅ Sucesso', 'Adicional criado!');
                try { localStorage.setItem('addons-updated', new Date().toISOString()); } catch(e){}
            } else {
                throw new Error(data.message || 'Erro ao criar adicional');
            }
        }
        
        renderizarAddonsList();
        fecharModalAddon();
    } catch (error) {
        console.error('Erro ao salvar adicional:', error);
        mostrarConfirmacao('❌ Erro', error.message || 'Erro ao salvar adicional');
    }
}

async function toggleAddonAtivo(index) {
    const addon = addons[index];
    if (!addon) return;
    
    const novoStatus = !addon.ativo;
    
    try {
        const response = await fetchTenant(`/addons/${encodeURIComponent(addon.name)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...addon, ativo: novoStatus })
        });
        const data = await parseJSONResponse(response);
        if (data.success) {
            addons[index].ativo = novoStatus;
            renderizarAddonsList();
            mostrarConfirmacao('✅ Sucesso', `Adicional ${novoStatus ? 'habilitado' : 'desabilitado'}!`);
            try { localStorage.setItem('addons-updated', new Date().toISOString()); } catch(e){}
        } else {
            throw new Error(data.message || 'Erro ao alterar status');
        }
    } catch (error) {
        console.error('Erro ao alterar status do adicional:', error);
        mostrarConfirmacao('❌ Erro', error.message || 'Erro ao alterar status do adicional');
    }
}

async function deletarAddon(index) {
    const addon = addons[index];
    if (!addon) return;
    
    const confirmou = await confirmar(`Tem certeza que deseja deletar o adicional "${addon.name}"?`, 'Deletar Adicional');
    if (!confirmou) {
        return;
    }
    
    try {
        const response = await fetchTenant(`/addons/${encodeURIComponent(addon.name)}`, {
            method: 'DELETE'
        });
        const data = await parseJSONResponse(response);
        if (data.success) {
            addons.splice(index, 1);
            renderizarAddonsList();
            mostrarConfirmacao('✅ Sucesso', 'Adicional deletado!');
            try { localStorage.setItem('addons-updated', new Date().toISOString()); } catch(e){}
        } else {
            throw new Error(data.message || 'Erro ao deletar adicional');
        }
    } catch (error) {
        console.error('Erro ao deletar adicional:', error);
        mostrarConfirmacao('❌ Erro', error.message || 'Erro ao deletar adicional');
    }
}

// Event listeners para adicionais (com checks de existência)
const closeAddonBtn = document.getElementById('close-addon-modal');
if (closeAddonBtn) closeAddonBtn.addEventListener('click', fecharModalAddon);
const cancelAddonBtn = document.getElementById('cancel-addon-btn');
if (cancelAddonBtn) cancelAddonBtn.addEventListener('click', fecharModalAddon);
const saveAddonBtn = document.getElementById('save-addon-btn');
if (saveAddonBtn) saveAddonBtn.addEventListener('click', salvarAddon);
const addAddonBtn = document.getElementById('add-addon-btn');
if (addAddonBtn) addAddonBtn.addEventListener('click', () => abrirModalAddon(-1));

// Carregar adicionais quando a aba for aberta (corrigido para data-tab="tab-addons")
const tabAddonsBtn = document.querySelector('[data-tab="tab-addons"]');
if (tabAddonsBtn) tabAddonsBtn.addEventListener('click', () => {
    carregarAddons();
});

