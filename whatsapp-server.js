/**
 * 📱 SERVIDOR WHATSAPP LOCAL
 * 100% GRATUITO - Roda no seu PC
 */

const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
app.use(express.json());

const PORT = 8000;
const API_KEY = 'padoca-local-2026';

let client = null;
let qrCodeData = null;
let isConnected = false;
let connectionStatus = 'initializing';

async function connectToWhatsApp() {
    try {
        console.log('🔄 Iniciando cliente WhatsApp...');
        
        client = new Client({
            authStrategy: new LocalAuth({
                dataPath: path.join(__dirname, '.wwebjs_auth')
            }),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });

        client.on('qr', async (qr) => {
            qrCodeData = qr;
            connectionStatus = 'qr_ready';
            console.log('📱 QR Code gerado! Acesse http://localhost:8000/qr');
        });

        client.on('ready', () => {
            isConnected = true;
            connectionStatus = 'connected';
            qrCodeData = null;
            console.log('✅ WhatsApp conectado!');
        });

        client.on('authenticated', () => {
            console.log('🔐 Autenticado!');
        });

        client.on('auth_failure', (msg) => {
            console.error('❌ Falha na autenticação:', msg);
            connectionStatus = 'auth_failed';
        });

        client.on('disconnected', () => {
            isConnected = false;
            connectionStatus = 'disconnected';
        });

        await client.initialize();
    } catch (error) {
        console.error('❌ Erro:', error);
    }
}

function authenticate(req, res, next) {
    const apiKey = req.headers['apikey'] || req.headers['authorization'];
    if (apiKey === API_KEY) {
        next();
    } else {
        res.status(401).json({ error: 'API Key inválida' });
    }
}

app.get('/', (req, res) => {
    const statusText = connectionStatus === 'connected' ? '✅ Conectado' : 
                      connectionStatus === 'qr_ready' ? '⏳ Aguardando QR' : 
                      '🔄 Iniciando...';
    
    res.send(`
        <!DOCTYPE html>
        <html><head><meta charset="UTF-8"><title>WhatsApp Server</title>
        <style>
            body{font-family:Arial;max-width:800px;margin:50px auto;padding:20px;background:#667eea;color:#fff}
            .card{background:rgba(255,255,255,0.1);padding:30px;border-radius:15px}
            .status{padding:15px;border-radius:10px;margin:20px 0;font-weight:bold;text-align:center;background:#10b981}
            .btn{display:inline-block;padding:12px 24px;margin:10px 5px;background:#fff;color:#667eea;text-decoration:none;border-radius:8px;font-weight:bold}
            code{background:rgba(0,0,0,0.3);padding:2px 8px;border-radius:4px}
        </style></head><body>
        <div class="card">
            <h1>📱 WhatsApp Server Local</h1>
            <div class="status">Status: ${statusText}</div>
            ${connectionStatus === 'qr_ready' ? '<a href="/qr" class="btn">📷 Ver QR Code</a>' : ''}
            ${connectionStatus === 'connected' ? '<div><p><strong>Token:</strong> <code>' + API_KEY + '</code></p></div>' : ''}
            <p><strong>URL:</strong> <code>http://localhost:${PORT}</code></p>
            <a href="/status" class="btn">📊 Status</a>
        </div>
        </body></html>
    `);
});

app.get('/qr', async (req, res) => {
    if (!qrCodeData) {
        return res.send('<html><head><meta http-equiv="refresh" content="3"></head><body style="text-align:center;padding:50px;background:#667eea;color:#fff"><h1>' + (isConnected ? '✅ Conectado!' : '⏳ Gerando QR...') + '</h1></body></html>');
    }
    
    try {
        const qrImage = await QRCode.toDataURL(qrCodeData);
        res.send(`<html><head><meta charset="UTF-8"></head><body style="text-align:center;padding:30px;background:#667eea;color:#fff"><h1>📱 Escaneie o QR Code</h1><img src="${qrImage}" width="300" style="background:#fff;padding:20px;border-radius:15px"><p><a href="/" style="color:#fff">Voltar</a></p></body></html>`);
    } catch (error) {
        res.status(500).send('Erro');
    }
});

app.get('/status', (req, res) => {
    res.json({
        status: connectionStatus,
        connected: isConnected,
        qrAvailable: !!qrCodeData
    });
});

app.post('/message/sendText/:instance', authenticate, async (req, res) => {
    try {
        if (!isConnected || !client) {
            return res.status(503).json({ success: false, message: 'WhatsApp não conectado' });
        }

        const { number, text } = req.body;
        if (!number || !text) {
            return res.status(400).json({ success: false, message: 'Número e texto obrigatórios' });
        }

        let numeroFormatado = number.replace('@s.whatsapp.net', '');
        if (!numeroFormatado.includes('@')) {
            numeroFormatado = `${numeroFormatado}@c.us`;
        }

        await client.sendMessage(numeroFormatado, text);
        console.log(`✅ Mensagem enviada para ${number}`);

        res.json({ success: true, message: 'Enviado', data: { number: numeroFormatado, text } });
    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({ success: false, message: 'Erro', error: error.message });
    }
});

app.listen(PORT, async () => {
    console.log('\n' + '='.repeat(50));
    console.log('📱 WHATSAPP SERVER LOCAL');
    console.log('='.repeat(50));
    console.log(`🌐 http://localhost:${PORT}`);
    console.log(`🔑 API Key: ${API_KEY}`);
    console.log('='.repeat(50) + '\n');
    await connectToWhatsApp();
});
