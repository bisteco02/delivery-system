/**
 * Módulo de Impressão Integrado
 * Funciona automaticamente como parte do servidor
 * Sem necessidade de scripts adicionais
 */

const axios = require('axios');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

class PrintService {
  constructor(apiUrl) {
    this.apiUrl = apiUrl;
    this.pollInterval = 5000;
    this.lastPrintedFile = path.join(__dirname, '.last-printed-id.txt');
    this.lastPrintedId = null;
    this.printerConfig = null;
    this.statusVerified = false;
    this.isRunning = false;
  }

  /**
   * Ler ID do último pedido impresso
   */
  readLastPrinted() {
    try {
      if (fs.existsSync(this.lastPrintedFile)) {
        this.lastPrintedId = fs.readFileSync(this.lastPrintedFile, 'utf8').trim();
      }
    } catch (error) {
      console.error('[PrintService] Erro ao ler último pedido:', error.message);
    }
  }

  /**
   * Salvar ID do pedido impresso
   */
  saveLastPrinted(id) {
    try {
      fs.writeFileSync(this.lastPrintedFile, id, 'utf8');
      this.lastPrintedId = id;
    } catch (error) {
      console.error('[PrintService] Erro ao salvar ID impresso:', error.message);
    }
  }

  /**
   * Buscar configuração de impressora
   */
  async buscarConfiguracaoImpressora() {
    try {
      const response = await axios.get(`${this.apiUrl}/api/printer/config`, {
        timeout: 5000
      });

      this.printerConfig = response.data;

      if (!this.statusVerified) {
        if (this.printerConfig.enabled) {
          console.log('[PrintService] ✅ Impressão habilitada');
          console.log(`[PrintService]    Impressora: ${this.printerConfig.selectedPrinter || 'Padrão'}`);
          console.log(`[PrintService]    Autoprint: ${this.printerConfig.autoprint ? 'Sim' : 'Não'}`);
        } else {
          console.log('[PrintService] ⏸️  Impressão desabilitada no painel');
        }
        this.statusVerified = true;
      }

      return this.printerConfig.enabled;
    } catch (error) {
      if (!this.statusVerified) {
        console.log('[PrintService] ⚠️  Aguardando ativação de impressora no painel admin');
      }
      return false;
    }
  }

  /**
   * Formatar HTML para impressão
   */
  gerarHTMLPedido(pedido) {
    const dataFormatada = new Date(pedido.data).toLocaleString('pt-BR');

    const itensHTML = pedido.itens
      .map(
        (item) => `
      <tr>
        <td style="text-align: center; padding: 5px;">${item.quantidade}</td>
        <td style="padding: 5px;">${item.nome}</td>
        <td style="text-align: right; padding: 5px;">R$ ${(item.preco * item.quantidade).toFixed(2)}</td>
      </tr>
    `
      )
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
        <p>Impressão automática - ${new Date().toLocaleString('pt-BR')}</p>
      </div>
    </body>
    </html>
  `;
  }

  /**
   * Imprimir pedido
   */
  imprimirPedido(pedido) {
    return new Promise((resolve) => {
      const html = this.gerarHTMLPedido(pedido);
      const tempFile = path.join(os.tmpdir(), `pedido-${pedido.id}.html`);

      fs.writeFileSync(tempFile, html);

      const platform = os.platform();
      let comando;

      if (platform === 'win32') {
        comando = `start "" "${tempFile}"`;
      } else if (platform === 'darwin') {
        comando = `open "${tempFile}"`;
      } else {
        comando = `xdg-open "${tempFile}"`;
      }

      // Se autoprint, enviar direto para impressora
      if (this.printerConfig && this.printerConfig.autoprint) {
        if (platform === 'win32') {
          comando = `powershell -NoProfile -Command "& {Add-Type –AssemblyName System.Printing; [System.Printing.PrintQueue]::OpenDefaultPrintQueue().AddJob('Pedido', '${tempFile}', $false)}"`;
        } else if (platform === 'darwin') {
          comando = `lpr "${tempFile}"`;
        } else {
          comando = `lp "${tempFile}" 2>/dev/null || lpr "${tempFile}"`;
        }
      }

      exec(comando, () => {
        setTimeout(() => {
          try {
            fs.unlinkSync(tempFile);
          } catch {}
        }, 2000);
        resolve(true);
      });
    });
  }

  /**
   * Buscar e imprimir novos pedidos
   */
  async buscarEImprimirPedidos() {
    try {
      const impressaoHabilitada = await this.buscarConfiguracaoImpressora();

      if (!impressaoHabilitada) {
        return;
      }

      const response = await axios.get(`${this.apiUrl}/api/pedidos`, {
        timeout: 5000
      });

      const pedidos = Array.isArray(response.data) ? response.data : response.data.pedidos || [];

      pedidos.sort((a, b) => new Date(b.data) - new Date(a.data));

      for (const pedido of pedidos) {
        if (pedido.id !== this.lastPrintedId && pedido.status === 'pendente') {
          console.log(`\n[PrintService] 📄 Novo pedido: #${pedido.id}`);
          console.log(`[PrintService]    Cliente: ${pedido.cliente.nome}`);
          console.log(`[PrintService]    Total: R$ ${pedido.total.toFixed(2)}`);

          try {
            console.log('[PrintService] 🖨️  Imprimindo...');
            await this.imprimirPedido(pedido);
            this.saveLastPrinted(pedido.id);
            console.log('[PrintService] ✅ Pedido impresso com sucesso!');
          } catch (error) {
            console.error('[PrintService] ❌ Erro ao imprimir:', error.message);
          }
        }
      }
    } catch (error) {
      // Silencioso se servidor não responder ainda
    }
  }

  /**
   * Iniciar serviço
   */
  async start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.readLastPrinted();

    console.log('\n[PrintService] 🖨️  Serviço de Impressão Integrado');
    console.log('[PrintService] ✅ Iniciado com sucesso\n');

    // Busca inicial
    await this.buscarEImprimirPedidos();

    // Polling contínuo
    this.intervalId = setInterval(() => this.buscarEImprimirPedidos(), this.pollInterval);
  }

  /**
   * Parar serviço
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.isRunning = false;
      console.log('[PrintService] ⏹️  Serviço parado');
    }
  }
}

module.exports = PrintService;
