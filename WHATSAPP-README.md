# 📱 WhatsApp Server Local - Guia Completo

## 🚀 Como Usar

### 1️⃣ Iniciar o Servidor WhatsApp

```bash
node whatsapp-server.js
```

### 2️⃣ Conectar seu WhatsApp

1. Abra o navegador: **http://localhost:8000**
2. Clique em **"Ver QR Code"**
3. Abra o WhatsApp no celular
4. Vá em **"Aparelhos Conectados"**
5. Escaneie o QR Code mostrado na tela

### 3️⃣ Configurar no Painel Admin

Depois de conectado, configure no painel administrativo:

**Aba Configurações → WhatsApp API:**

- **Número do WhatsApp:** Seu número com DDD (ex: `11987654321`)
- **Token/API Key:** `padoca-local-2026`

**Salve as configurações!**

---

## ✅ Tudo Pronto!

Agora o sistema vai enviar mensagens automáticas:

- ✅ Pedido confirmado → Cliente recebe notificação
- 🎉 Pedido pronto → "Seu pedido está pronto!"
- 🚗 A caminho → "Pedido saiu para entrega!"

---

## 🔧 Configuração Avançada

### URL da API
Por padrão: `http://localhost:8000`

Se quiser acessar de outro computador na rede:
- Descubra seu IP local: `ipconfig` (Windows) ou `ifconfig` (Linux/Mac)
- Use: `http://SEU_IP:8000`

### API Key
Padrão: `padoca-local-2026`

Para alterar, edite a linha no arquivo `whatsapp-server.js`:
```javascript
const API_KEY = 'sua-chave-aqui';
```

---

## 🆘 Problemas Comuns

### QR Code não aparece
- Aguarde 30 segundos
- Atualize a página
- Reinicie o servidor

### Mensagens não estão sendo enviadas
1. Verifique se o servidor está rodando: `http://localhost:8000/status`
2. Confirme que está "connected"
3. Verifique se configurou corretamente no painel admin

### Desconectou sozinho
- Normal! Apenas escaneie o QR Code novamente
- WhatsApp desconecta após 14 dias de inatividade

---

## 💡 Dicas

✅ **Mantenha o servidor rodando** sempre que quiser enviar mensagens

✅ **Use Auto Confirmar** no painel para automatizar tudo

✅ **Teste primeiro** enviando mensagem manual antes de ativar automação

---

## 🌐 Acesso Externo (Opcional)

Para acessar de fora da sua rede local, use:

**Ngrok (Grátis):**
```bash
ngrok http 8000
```

Depois use a URL fornecida no painel admin.

---

**🎉 Pronto! WhatsApp 100% gratuito e funcional!**
