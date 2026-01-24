# 🚀 GUIA DE DEPLOY - UMBLER

## 📋 Pré-requisitos

1. Conta na Umbler (https://umbler.com)
2. Git instalado no PC
3. Projeto funcionando localmente

---

## 🔧 Passo a Passo

### 1️⃣ Preparar o Projeto

**a) Instalar Git (se não tiver):**
- Download: https://git-scm.com/download/win
- Instale com configurações padrão

**b) Inicializar repositório Git:**
```bash
git init
git add .
git commit -m "Deploy inicial - Sistema Padoca"
```

---

### 2️⃣ Criar Conta na Umbler

1. Acesse: https://umbler.com
2. Clique em **"Experimente Grátis"**
3. Crie sua conta
4. Escolha o plano **Node.js** (R$ 19/mês)

---

### 3️⃣ Criar Projeto na Umbler

1. No painel Umbler, clique em **"Novo Projeto"**
2. Escolha **"Node.js"**
3. Configure:
   - **Nome:** padoca-site
   - **Versão Node:** 18.x ou superior
   - **Comando de start:** `npm start`
   - **Porta:** (deixe automático)

---

### 4️⃣ Conectar via Git

**Na Umbler:**
1. Vá em **"Deploy" → "Git"**
2. Copie a URL do repositório Git fornecida
3. Exemplo: `git@umbler.com:seu-usuario/padoca.git`

**No seu PC:**
```bash
# Adicionar repositório remoto da Umbler
git remote add umbler git@umbler.com:seu-usuario/padoca.git

# Enviar código
git push umbler master
```

---

### 5️⃣ Configurar Variáveis de Ambiente

No painel Umbler:
1. Vá em **"Configurações" → "Variáveis de Ambiente"**
2. Adicione:
   ```
   NODE_ENV=production
   PORT=3001
   WHATSAPP_PORT=8000
   WHATSAPP_API_KEY=padoca-local-2026
   ```

---

### 6️⃣ Deploy do WhatsApp Server

**Opção A: No mesmo servidor Umbler**
- O arquivo `whatsapp-server.js` já vai junto
- Acesse via: `https://seu-dominio.umbler.net:8000`

**Opção B: Separado no Railway (Recomendado)**
1. Acesse: https://railway.app
2. Conecte com GitHub
3. Faça upload do `whatsapp-server.js`
4. Configure porta 8000
5. Copie URL gerada: `https://seu-whatsapp.railway.app`

---

### 7️⃣ Conectar Domínio (Opcional)

1. Compre um domínio (ex: padocadodede.com.br)
2. No painel Umbler: **"Domínios" → "Adicionar Domínio"**
3. Configure DNS conforme instruções
4. SSL automático será ativado

---

### 8️⃣ Configurar WhatsApp

**Depois do deploy:**

1. Acesse o WhatsApp Server: `https://seu-dominio.umbler.net:8000`
2. Escaneie o QR Code
3. No painel admin do site, configure:
   - **URL:** `https://seu-dominio.umbler.net:8000` ou URL do Railway
   - **Token:** `padoca-local-2026`
   - **Número:** Seu número com DDD

---

## ✅ Checklist Final

- [ ] Código enviado via Git
- [ ] Build executado com sucesso
- [ ] Site acessível via URL da Umbler
- [ ] Banco de dados funcionando
- [ ] WhatsApp conectado
- [ ] SSL ativado (HTTPS)
- [ ] Testes de pedido funcionando

---

## 🆘 Problemas Comuns

### Build falhou
```bash
# Limpar cache e reinstalar
npm clean-install
npm run build
```

### WhatsApp não conecta
- Verifique se porta 8000 está aberta
- Confirme variáveis de ambiente
- Use Railway se não funcionar na Umbler

### Erro de permissão Git
```bash
# Gerar chave SSH
ssh-keygen -t rsa -b 4096 -C "seu@email.com"
# Adicionar chave pública no painel Umbler
```

---

## 📱 Suporte

**Umbler:**
- Email: suporte@umbler.com
- Chat: No painel (canto inferior direito)

**Railway:**
- Discord: https://discord.gg/railway
- Docs: https://docs.railway.app

---

## 🎉 Pronto!

Seu site está no ar! 🚀

**URLs importantes:**
- Site: `https://seu-dominio.umbler.net`
- Painel Admin: `https://seu-dominio.umbler.net/painel-admin.html`
- WhatsApp Status: `https://seu-dominio.umbler.net:8000`

**Custos:**
- Umbler: R$ 19/mês (tudo incluso)
- Railway (opcional): R$ 5-10/mês ou grátis
- **Total: ~R$ 20-30/mês**
