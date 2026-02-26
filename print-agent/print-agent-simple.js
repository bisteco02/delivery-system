#!/usr/bin/env node

/**
 * AGENTE LOCAL DE IMPRESSÃO (Simples e confiável)
 * - Sem Puppeteer
 * - Sem pdf-to-printer
 * - Só Windows nativo
 */

const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

const configPath = path.join(__dirname, 'config.json');
const statePath = path.join(__dirname, '.agent-state.json');

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const API_URL = config.API_URL;
const PRINTER_NAME = config.PRINTER_NAME || null;
const AUTOPRINT = config.AUTOPRINT !== false;
const IGNORE_EXISTING_ON_START = config.IGNORE_EXISTING_ON_START !== false;
const POLL_INTERVAL_MS = config.POLL_INTERVAL_MS || 5000;

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

function gerarHTMLPedido(pedido) {
  const dataFormatada = new Date(pedido.data).toLocaleString('pt-BR');
  const itensHTML = pedido.itens.map(item => `
    <tr>
      <td style="text-align:center;padding:5px;border:1px solid #ccc;">${item.quantidade}</td>
      <td style="padding:5px;border:1px solid #ccc;">${item.nome}</td>
      <td style="text-align:right;padding:5px;border:1px solid #ccc;">R$ ${(item.preco * item.quantidade).toFixed(2)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; padding: 12px; font-size: 12px; margin: 0; }
    .header { text-align: center; margin-bottom: 10px; }
    .pedido-id { font-size: 16px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; }
    th { border: 1px solid #000; padding: 5px; text-align: left; background: #f0f0f0; }
    td { border: 1px solid #ccc; padding: 5px; }
    .total { background: #f0f0f0; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <div class="pedido-id">NOVO PEDIDO #${pedido.id}</div>
    <small>${dataFormatada}</small>
  </div>
  
  <div style="margin: 10px 0;">
    <div><strong>Cliente:</strong> ${pedido.cliente.nome}</div>
    <div><strong>Telefone:</strong> ${pedido.cliente.whatsapp}</div>
    <div><strong>Endereco:</strong> ${pedido.endereco}, ${pedido.bairro}</div>
  </div>
  
  <table style="width: 100%; margin: 10px 0;">
    <thead>
      <tr>
        <th style="width:15%">Qtd</th>
        <th style="width:60%">Descricao</th>
        <th style="width:25%">Valor</th>
      </tr>
    </thead>
    <tbody>
      ${itensHTML}
      <tr class="total">
        <td colspan="2" style="text-align:right">TOTAL:</td>
        <td style="text-align:right">R$ ${pedido.total.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>
  
  <div style="text-align: center; font-size: 10px; margin-top: 10px;">
    Impresso em ${new Date().toLocaleTimeString('pt-BR')}
  </div>
</body>
</html>`;
}

async function gerarHTMFile(html, filePath) {
  fs.writeFileSync(filePath, html, 'utf8');
  log(`✅ Arquivo HTML criado: ${filePath}`);
}

async function imprimirPedido(pedido) {
  const htmlPath = path.join(os.tmpdir(), `pedido-${pedido.id}.html`);
  
  try {
    const html = gerarHTMLPedido(pedido);
    await gerarHTMFile(html, htmlPath);
    
    // Imprime usando o navegador padrão do Windows
    const cmd = `start "" "${htmlPath}"`;
    await execAsync(cmd);
    
    log(`🖨️ Pedido #${pedido.id} aberto no navegador para impressão`);
    
    // Aguarda um pouco antes de deletar (dá tempo do navegador abrir)
    setTimeout(() => {
      try { fs.unlinkSync(htmlPath); } catch {}
    }, 3000);
    
  } catch (error) {
    log(`❌ Erro ao imprimir: ${error.message}`);
    throw error;
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
      log(`✅ Agente sincronizado. Aguardando novos pedidos...`);
      isPolling = false;
      return;
    }

    for (const pedido of pedidos) {
      if (pedido.status !== 'pendente') continue;
      if (!lastPrintedAt || isNovoPedido(pedido)) {
        log(`📤 Novo pedido #${pedido.id} detectado. Preparando impressão...`);
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
  log(`🚀 Agente iniciado`);
  log(`📍 Servidor: ${API_URL}`);
  log(`🖨️  Impressora: ${PRINTER_NAME || 'padrão do Windows'}`);
  log(`⏱️  Intervalo: ${POLL_INTERVAL_MS}ms`);
  
  loadState();
  setInterval(loop, POLL_INTERVAL_MS);
  await loop();
}

start().catch(e => {
  log(`❌ Erro fatal: ${e.message}`);
  process.exit(1);
});
