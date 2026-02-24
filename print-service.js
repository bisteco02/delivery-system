/**
 * Serviço de Impressão Automática de Pedidos
 * Execute: node print-service.js
 * 
 * Este serviço monitora novos pedidos e imprime automaticamente
 * na impressora padrão do sistema
 */

const axios = require('axios');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

// Configurações
const API_URL = process.env.API_URL || 'http://localhost:3001'; // Altere para seu servidor
const POLL_INTERVAL = 5000; // Verificar a cada 5 segundos
const PRINTER_NAME = process.env.PRINTER_NAME || 'Padrão'; // Nome da impressora

// Arquivo para rastrear últimos pedidos impressos
const lastPrintedFile = path.join(__dirname, '.last-printed-id.txt');

let lastPrintedId = null;

/**
 * Ler ID do último pedido impresso
 */
function readLastPrinted() {
  try {
    if (fs.existsSync(lastPrintedFile)) {
      lastPrintedId = fs.readFileSync(lastPrintedFile, 'utf8').trim();
    }
  } catch (error) {
    console.error('❌ Erro ao ler último pedido:', error.message);
  }
}

/**
 * Salvar ID do pedido impresso
 */
function saveLastPrinted(id) {
  try {
    fs.writeFileSync(lastPrintedFile, id, 'utf8');
    lastPrintedId = id;
  } catch (error) {
    console.error('❌ Erro ao salvar ID impresso:', error.message);
  }
}

/**
 * Formatar HTML para impressão do pedido
 */
function gerarHTMLPedido(pedido) {
  const dataFormatada = new Date(pedido.data).toLocaleString('pt-BR');
  
  const itensHTML = pedido.itens
    .map(item => `
      <tr>
        <td style="text-align: center; padding: 5px;">${item.quantidade}</td>
        <td style="padding: 5px;">${item.nome}</td>
        <td style="text-align: right; padding: 5px;">R$ ${(item.preco * item.quantidade).toFixed(2)}</td>
      </tr>
    `)
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Pedido #${pedido.id}</title>
      <style>
        @media print {
          body { margin: 0; padding: 0; }
          * { box-sizing: border-box; }
        }
        body {
          font-family: Arial, sans-serif;
          font-size: 12px;
          line-height: 1.4;
          margin: 0;
          padding: 10px;
          background: white;
        }
        .header {
          text-align: center;
          margin-bottom: 10px;
          border-bottom: 2px solid #000;
          padding-bottom: 5px;
        }
        .header h2 {
          margin: 0;
          font-size: 16px;
        }
        .pedido-id {
          font-weight: bold;
          font-size: 14px;
          margin: 5px 0;
        }
        .section {
          margin: 10px 0;
        }
        .label {
          font-weight: bold;
          margin-top: 5px;
          margin-bottom: 2px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0;
        }
        th {
          background: #f0f0f0;
          border: 1px solid #000;
          padding: 5px;
          text-align: left;
          font-weight: bold;
        }
        td {
          border: 1px solid #ccc;
        }
        .total-row {
          background: #f0f0f0;
          font-weight: bold;
        }
        .footer {
          text-align: center;
          margin-top: 10px;
          padding-top: 5px;
          border-top: 1px solid #000;
          font-size: 10px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>🍕 NOVO PEDIDO</h2>
        <div class="pedido-id">Pedido #${pedido.id}</div>
        <small>${dataFormatada}</small>
      </div>

      <div class="section">
        <div class="label">Cliente:</div>
        <div>${pedido.cliente.nome}</div>
        <div class="label">Telefone:</div>
        <div>${pedido.cliente.whatsapp}</div>
      </div>

      <div class="section">
        <div class="label">Endereço:</div>
        <div>${pedido.endereco}, ${pedido.bairro}</div>
        ${pedido.referencia ? `<div><small>Ref: ${pedido.referencia}</small></div>` : ''}
      </div>

      <div class="section">
        <div class="label">Itens:</div>
        <table>
          <thead>
            <tr>
              <th style="width: 15%;">Qtd</th>
              <th style="width: 60%;">Descrição</th>
              <th style="width: 25%;">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${itensHTML}
            <tr class="total-row">
              <td colspan="2" style="text-align: right;">TOTAL:</td>
              <td style="text-align: right;">R$ ${pedido.total.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      ${pedido.observacoes ? `
      <div class="section">
        <div class="label">Observações:</div>
        <div>${pedido.observacoes}</div>
      </div>
      ` : ''}

      <div class="section">
        <div class="label">Forma de Pagamento:</div>
        <div>${pedido.pagamento?.forma || 'Não especificado'}</div>
      </div>

      <div class="footer">
        <p>Imprensão automática - ${new Date().toLocaleString('pt-BR')}</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Imprimir pedido (Windows, Mac ou Linux)
 */
function imprimirPedido(pedido) {
  return new Promise((resolve, reject) => {
    const html = gerarHTMLPedido(pedido);
    const tempFile = path.join(os.tmpdir(), `pedido-${pedido.id}.html`);

    // Salvar HTML temporário
    fs.writeFileSync(tempFile, html);

    const platform = os.platform();
    let comando;

    if (platform === 'win32') {
      // Windows
      comando = `start "" "${tempFile}"`;
    } else if (platform === 'darwin') {
      // macOS
      comando = `open "${tempFile}"`;
    } else {
      // Linux
      comando = `xdg-open "${tempFile}"`;
    }

    exec(comando, (error) => {
      setTimeout(() => {
        try {
          fs.unlinkSync(tempFile);
        } catch {}
      }, 3000);

      if (error) {
        reject(error);
      } else {
        resolve(true);
      }
    });
  });
}

/**
 * Buscar novos pedidos no servidor
 */
async function buscarNovosPedidos() {
  try {
    const response = await axios.get(`${API_URL}/api/pedidos`, {
      timeout: 5000
    });

    const pedidos = Array.isArray(response.data) ? response.data : response.data.pedidos || [];
    
    // Ordenar por data (mais recentes primeiro)
    pedidos.sort((a, b) => new Date(b.data) - new Date(a.data));

    // Buscar pedidos não impressos
    for (const pedido of pedidos) {
      if (pedido.id !== lastPrintedId && pedido.status === 'pendente') {
        console.log(`\n📄 Novo pedido encontrado: #${pedido.id}`);
        console.log(`   Cliente: ${pedido.cliente.nome}`);
        console.log(`   Total: R$ ${pedido.total.toFixed(2)}`);
        
        try {
          console.log('🖨️  Imprimindo...');
          await imprimirPedido(pedido);
          saveLastPrinted(pedido.id);
          console.log('✅ Pedido impresso com sucesso!');
        } catch (error) {
          console.error('❌ Erro ao imprimir:', error.message);
        }
      }
    }
  } catch (error) {
    console.error(`⚠️  Erro ao buscar pedidos: ${error.message}`);
  }
}

/**
 * Iniciar serviço
 */
function iniciar() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║  🖨️  SERVIÇO DE IMPRESSÃO AUTOMÁTICA       ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log(`\n📡 Conectando ao servidor: ${API_URL}`);
  console.log(`⏱️  Verificando a cada ${POLL_INTERVAL / 1000} segundos`);
  console.log(`🖨️  Impressora: ${PRINTER_NAME}\n`);

  readLastPrinted();

  // Verificação inicial
  buscarNovosPedidos();

  // Iniciar polling
  setInterval(buscarNovosPedidos, POLL_INTERVAL);

  console.log('✅ Serviço iniciado. Aguardando pedidos...\n');
}

// Iniciar
iniciar();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Encerrando serviço de impressão...');
  process.exit(0);
});
