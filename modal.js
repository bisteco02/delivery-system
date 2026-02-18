// Sistema de Modal Moderno
const criarModal = () => {
  const modal = document.createElement('div');
  modal.id = 'modal-sistema';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    font-family: 'Poppins', sans-serif;
  `;
  modal.innerHTML = `
    <div style="
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      width: 90%;
      max-width: 400px;
      padding: 30px;
      text-align: center;
      animation: slideUp 0.3s ease-out;
    ">
      <i id="modal-icon" style="font-size: 50px; margin-bottom: 15px; display: block;"></i>
      <h2 id="modal-titulo" style="color: #333; font-size: 20px; font-weight: 600; margin-bottom: 10px;"></h2>
      <p id="modal-mensagem" style="color: #666; font-size: 14px; margin-bottom: 25px; line-height: 1.6;"></p>
      <div id="modal-botoes" style="display: flex; gap: 10px; justify-content: center;"></div>
    </div>
    <style>
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(30px); }
        to { opacity: 1; transform: translateY(0); }
      }
    </style>
  `;
  document.body.appendChild(modal);
  return modal;
};

const obterModal = () => {
  let modal = document.getElementById('modal-sistema');
  if (!modal) {
    modal = criarModal();
  }
  return modal;
};

const fecharModal = () => {
  const modal = obterModal();
  modal.style.display = 'none';
};

const mostrarModal = (config) => {
  const {
    titulo = 'Informação',
    mensagem = '',
    tipo = 'info', // 'success', 'error', 'warning', 'info'
    botoes = [{ texto: 'OK', acao: fecharModal, tipo: 'primario' }]
  } = config;

  const modal = obterModal();
  const iconElement = modal.querySelector('#modal-icon');
  const tituloElement = modal.querySelector('#modal-titulo');
  const mensagemElement = modal.querySelector('#modal-mensagem');
  const botoesContainer = modal.querySelector('#modal-botoes');

  // Definir ícone e cor baseado no tipo
  const configTipo = {
    success: { icon: 'fas fa-check-circle', color: '#28a745' },
    error: { icon: 'fas fa-exclamation-circle', color: '#dc3545' },
    warning: { icon: 'fas fa-exclamation-triangle', color: '#ffc107' },
    info: { icon: 'fas fa-info-circle', color: '#17a2b8' }
  };

  const config_tipo_selecionada = configTipo[tipo] || configTipo.info;
  iconElement.className = config_tipo_selecionada.icon;
  iconElement.style.color = config_tipo_selecionada.color;

  tituloElement.textContent = titulo;
  mensagemElement.textContent = mensagem;

  // Limpar botões anteriores
  botoesContainer.innerHTML = '';

  // Adicionar botões
  botoes.forEach(botao => {
    const btn = document.createElement('button');
    btn.textContent = botao.texto;
    btn.style.cssText = `
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.3s ease;
      font-family: 'Poppins', sans-serif;
      flex: 1;
      ${botao.tipo === 'primario' ? `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      ` : `
        background: #f0f0f0;
        color: #333;
      `}
    `;
    btn.onmouseover = () => {
      if (botao.tipo === 'primario') {
        btn.style.transform = 'translateY(-2px)';
        btn.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.3)';
      } else {
        btn.style.backgroundColor = '#e0e0e0';
      }
    };
    btn.onmouseout = () => {
      if (botao.tipo === 'primario') {
        btn.style.transform = 'translateY(0)';
        btn.style.boxShadow = 'none';
      } else {
        btn.style.backgroundColor = '#f0f0f0';
      }
    };
    btn.onclick = () => {
      fecharModal();
      if (botao.acao) botao.acao();
    };
    botoesContainer.appendChild(btn);
  });

  modal.style.display = 'flex';
};

// Funções de conveniência
const alerta = (mensagem) => {
  mostrarModal({
    titulo: 'Informação',
    mensagem,
    tipo: 'info',
    botoes: [{ texto: 'OK', acao: fecharModal, tipo: 'primario' }]
  });
};

const sucesso = (mensagem) => {
  mostrarModal({
    titulo: '✅ Sucesso',
    mensagem,
    tipo: 'success',
    botoes: [{ texto: 'OK', acao: fecharModal, tipo: 'primario' }]
  });
};

const erro = (mensagem) => {
  mostrarModal({
    titulo: '❌ Erro',
    mensagem,
    tipo: 'error',
    botoes: [{ texto: 'OK', acao: fecharModal, tipo: 'primario' }]
  });
};

const aviso = (mensagem) => {
  mostrarModal({
    titulo: '⚠️ Atenção',
    mensagem,
    tipo: 'warning',
    botoes: [{ texto: 'OK', acao: fecharModal, tipo: 'primario' }]
  });
};

// Confirmação com retorno de Promise
const confirmar = (mensagem, titulo = 'Confirmação') => {
  return new Promise((resolve) => {
    mostrarModal({
      titulo,
      mensagem,
      tipo: 'info',
      botoes: [
        { 
          texto: 'Cancelar', 
          acao: () => resolve(false), 
          tipo: 'secundario' 
        },
        { 
          texto: 'Confirmar', 
          acao: () => resolve(true), 
          tipo: 'primario' 
        }
      ]
    });
  });
};
