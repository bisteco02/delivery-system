#!/usr/bin/env node

/**
 * AGENTE LOCAL DE IMPRESSÃO (100% automático)
 * - Roda no PC da loja
 * - Detecta impressoras locais
 * - Imprime silenciosamente (sem abrir páginas)
 */

const axios = require('axios');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { print } = require('pdf-to-printer');
const puppeteer = require('puppeteer');

const configPath = path.join(__dirname, 'config.json');
const statePath = path.join(__dirname, '.agent-state.json');

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const API_URL = config.API_URL;
const PRINTER_NAME = config.PRINTER_NAME || null;
const AUTOPRINT = config.AUTOPRINT !== false;
const IGNORE_EXISTING_ON_START = config.IGNORE_EXISTING_ON_START !== false;
const POLL_INTERVAL_MS = config.POLL_INTERVAL_MS || 5000;
const PRINT_TIMEOUT_MS = config.PRINT_TIMEOUT_MS || 60000;
const PRINT_RETRY_COUNT = config.PRINT_RETRY_COUNT || 3;
const PRINT_RETRY_DELAY_MS = config.PRINT_RETRY_DELAY_MS || 3000;

let lastPrintedAt = null;
let isFirstRun = true;
let isPolling = false;

function log(msg) {
  const time = new Date().toLocaleTimeString('pt-BR');
  console.log(`[${time}] ${msg}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadState() {
  try {
    if (fs.existsSync(statePath)) {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      lastPrintedAt = state.lastPrintedAt || null;
    }
  } catch (e) {
    lastPrintedAt = null;
  }
}

function saveState() {
  try {
    fs.writeFileSync(statePath, JSON.stringify({ lastPrintedAt }, null, 2));
  } catch {}
}

function detectPrintersWin() {
  return new Promise((resolve) => {
    const cmd = `powershell -Command "
      $printers = @()
      try { $printers += Get-Printer -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name } catch {}
      try { $wmi = Get-WmiObject Win32_Printer -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name; if ($wmi) { $printers += $wmi } } catch {}
      try {
        $devices = Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Devices' -ErrorAction SilentlyContinue | Select-Object -Property * -ExcludeProperty PS*
        if ($devices) { $devices.PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' } | ForEach-Object { $printers += $_.Name } }
      } catch {}
      try {
        $regPrinters = Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Print\\Printers' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty PSChildName
        if ($regPrinters) { $printers += $regPrinters }
      } catch {}
      $printers | Select-Object -Unique
    "`;

    exec(cmd, (error, stdout) => {
      const printers = (stdout || '')
        .split('\n')
        .map(p => p.trim())
        .filter(p => p && !p.startsWith('---'));
      if (!printers.length) {
        exec('cmd /c wmic printer get name', (err2, out2) => {
          const fallback = (out2 || '')
            .split('\n')
            .map(p => p.trim())
            .filter(p => p && p.toLowerCase() !== 'name');
          resolve(fallback);
        });
        return;
      }
      resolve(printers);
    });
  });
}

async function detectPrinters() {
  if (os.platform() === 'win32') {
    const printers = await detectPrintersWin();
    if (printers.length) {
      log(`Impressoras detectadas: ${printers.join(', ')}`);
    } else {
      log('⚠️ Nenhuma impressora detectada. Verifique se está instalada no Windows (Configurações → Impressoras).');
    }
    return printers;
  }
  log('Detecção automática não suportada neste SO.');
  return [];
}

function gerarHTMLPedido(pedido) {
  const dataFormatada = new Date(pedido.data).toLocaleString('pt-BR');
  const itensHTML = pedido.itens.map(item => `
    <tr>
      <td style="text-align:center;padding:5px;">${item.quantidade}</td>
      <td style="padding:5px;">${item.nome}</td>
      <td style="text-align:right;padding:5px;">R$ ${(item.preco * item.quantidade).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Courier New', monospace; padding: 12px; font-size: 12px; }
        .header { text-align: center; margin-bottom: 10px; }
        .pedido-id { font-size: 16px; font-weight: bold; }
        .section { margin: 8px 0; padding: 5px 0; border-bottom: 1px solid #ccc; }
        table { width: 100%; border-collapse: collapse; }
        th { border-bottom: 2px solid #000; padding: 5px; text-align: left; }
        td { border: 1px solid #ccc; padding: 5px; }
        .total-row { background: #f0f0f0; font-weight: bold; }
        .footer { text-align: center; margin-top: 10px; font-size: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="pedido-id">🍕 NOVO PEDIDO</div>
        <div class="pedido-id">#${pedido.id}</div>
        <small>${dataFormatada}</small>
      </div>
      <div class="section">
        <div><strong>Cliente:</strong> ${pedido.cliente.nome}</div>
        <div><strong>Telefone:</strong> ${pedido.cliente.whatsapp}</div>
      </div>
      <div class="section">
        <div><strong>Endereço:</strong> ${pedido.endereco}, ${pedido.bairro}</div>
        ${pedido.referencia ? `<div><small>Ref: ${pedido.referencia}</small></div>` : ''}
      </div>
      <div class="section">
        <table>
          <thead>
            <tr><th style="width:15%">Qtd</th><th style="width:60%">Descrição</th><th style="width:25%">Valor</th></tr>
          </thead>
          <tbody>
            ${itensHTML}
            <tr class="total-row">
              <td colspan="2" style="text-align:right">TOTAL:</td>
              <td style="text-align:right">R$ ${pedido.total.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="footer">Impresso em ${new Date().toLocaleTimeString('pt-BR')}</div>
    </body>
    </html>
  `;
}

async function gerarPDF(html, filePath) {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.pdf({ path: filePath, format: 'A4', printBackground: true });
  await browser.close();
}

async function verificarImpressoraDisponivel() {
  return new Promise((resolve) => {
    exec('powershell -Command "Get-Printer | Select-Object -ExpandProperty Name"', (error, stdout) => {
      const printers = (stdout || '')
        .split('\n')
        .map(p => p.trim())
        .filter(p => p && !p.startsWith('---'));
      
      const hasTarget = PRINTER_NAME && printers.some(p => p.toLowerCase() === PRINTER_NAME.toLowerCase());
      resolve(hasTarget);
    });
  });
}

async function imprimirPedidoViaComando(pdfPath) {
  return new Promise((resolve, reject) => {
    const escapedPath = `"${pdfPath}"`;
    const escapedPrinter = `"${PRINTER_NAME}"`;
    
    // Tenta usar PowerShell (mais confiável que pdf-to-printer)
    const cmd = `powershell -Command "Add-PrinterPort -Name 'LPT1:' -LprHostAddress localhost -LprQueueName 'PADOCA' -ErrorAction SilentlyContinue | Out-Null; Start-Process -FilePath 'C:\\Windows\\System32\\rundll32.exe' -ArgumentList 'printui.dll,PrintUIEntry /pt /n ${escapedPrinter} ${escapedPath}' -Wait -WindowStyle Hidden"`;
    
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Erro ao imprimir via PowerShell: ${error.message || error}`));
      } else {
        resolve();
      }
    });
  });
}

async function imprimirPedidoViaPdfToPrinter(pdfPath) {
  const options = PRINTER_NAME
    ? { printer: PRINTER_NAME, timeout: 10000 }
    : { timeout: 10000 };

  return print(pdfPath, options);
}

async function imprimirPedido(pedido) {
  const html = gerarHTMLPedido(pedido);
  const pdfPath = path.join(os.tmpdir(), `pedido-${pedido.id}.pdf`);

  try {
    await gerarPDF(html, pdfPath);
    log(`✅ PDF gerado: ${pdfPath}`);
  } catch (error) {
    log(`❌ Erro ao gerar PDF: ${error.message}`);
    throw error;
  }

  log(`🖨️ Impressora alvo: ${PRINTER_NAME || 'Padrão do Windows'}`);

  const impressoraDisponivel = await verificarImpressoraDisponivel();
  
  if (!impressoraDisponivel && PRINTER_NAME) {
    log(`⚠️ Impressora "${PRINTER_NAME}" não encontrada. Salvando PDF em ${os.homedir()}\\Desktop`);
    const desktopPath = path.join(os.homedir(), 'Desktop', `pedido-${pedido.id}.pdf`);
    try {
      fs.copyFileSync(pdfPath, desktopPath);
      log(`✅ PDF salvo em Desktop: ${desktopPath}`);
    } catch (e) {
      log(`⚠️ Não foi possível salvar em Desktop: ${e.message}`);
    }
    setTimeout(() => {
      try { fs.unlinkSync(pdfPath); } catch {}
    }, 2000);
    return;
  }

  let lastError = null;
  
  // Tenta múltiplos métodos
  const metodos = [
    { nome: 'pdf-to-printer', fn: () => imprimirPedidoViaPdfToPrinter(pdfPath) },
    { nome: 'PowerShell/rundll32', fn: () => imprimirPedidoViaComando(pdfPath) }
  ];

  for (const metodo of metodos) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        log(`📤 Tentando imprimir via ${metodo.nome} (tentativa ${attempt}/2)...`);
        await metodo.fn();
        lastError = null;
        log(`✅ Pedido #${pedido.id} impresso com sucesso via ${metodo.nome}!`);
        setTimeout(() => {
          try { fs.unlinkSync(pdfPath); } catch {}
        }, 2000);
        return;
      } catch (error) {
        lastError = error;
        log(`⚠️ Falha no ${metodo.nome} (tentativa ${attempt}/2): ${error.message || error}`);
        await sleep(1000);
      }
    }
  }

  if (lastError) {
    log(`❌ Falha em todos os métodos de impressão. Salvando PDF em Desktop...`);
    const desktopPath = path.join(os.homedir(), 'Desktop', `pedido-${pedido.id}.pdf`);
    try {
      fs.copyFileSync(pdfPath, desktopPath);
      log(`✅ PDF salvo em Desktop como fallback: ${desktopPath}`);
    } catch (e) {
      log(`⚠️ Erro ao salvar em Desktop: ${e.message}`);
    }
    setTimeout(() => {
      try { fs.unlinkSync(pdfPath); } catch {}
    }, 2000);
    throw lastError;
  }
}

async function buscarPedidos() {
  const response = await axios.get(`${API_URL}/api/pedidos`, { timeout: 15000 });
  return Array.isArray(response.data) ? response.data : response.data.pedidos || [];
}

function isNovoPedido(pedido) {
  if (!lastPrintedAt) return false;
  return new Date(pedido.data) > new Date(lastPrintedAt);
}

async function loop() {
  if (isPolling) return;
  isPolling = true;
  try {
    const pedidos = await buscarPedidos();
    pedidos.sort((a, b) => new Date(a.data) - new Date(b.data));

    if (isFirstRun && IGNORE_EXISTING_ON_START) {
      if (pedidos.length > 0) {
        lastPrintedAt = pedidos[pedidos.length - 1].data;
        saveState();
      }
      isFirstRun = false;
      return;
    }

    for (const pedido of pedidos) {
      if (pedido.status !== 'pendente') continue;
      if (!lastPrintedAt || isNovoPedido(pedido)) {
        log(`🖨️ Imprimindo pedido #${pedido.id}...`);
        if (AUTOPRINT) {
          await imprimirPedido(pedido);
        }
        lastPrintedAt = pedido.data;
        saveState();
      }
    }
  } catch (e) {
    log(`⚠️ Erro: ${e.message || e}`);
  } finally {
    isPolling = false;
  }
}

async function start() {
  log(`Agente local iniciado. Servidor: ${API_URL}`);
  loadState();
  await detectPrinters();
  setInterval(loop, POLL_INTERVAL_MS);
  await loop();
}

start();
