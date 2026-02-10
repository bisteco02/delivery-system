# ✅ Checklist - Deploy Umbler

## Antes de Começar

- [ ] Código testado localmente (rode `npm start`)
- [ ] WhatsApp funcionando localmente
- [ ] Painel admin funcionando

---

## 1️⃣ Preparar Repositório Git

```bash
# Na pasta do projeto
cd C:\Users\Mm\Desktop\PadocaSite2

# Inicializar Git (se ainda não tiver)
git init

# Adicionar arquivos
git add .

# Commit
git commit -m "Deploy inicial"
```

---

## 2️⃣ GitHub

- [ ] Criar conta no GitHub (se não tiver)
- [ ] Criar repositório **PRIVADO**: https://github.com/new
- [ ] Nome sugerido: `delivery-system`

```bash
# Conectar ao GitHub (TROCAR pela sua URL)
git remote add origin https://github.com/SEU-USUARIO/delivery-system.git
git branch -M main
git push -u origin main
```

---

## 3️⃣ Umbler

### Criar Conta
- [ ] Acessar: https://www.umbler.com/
- [ ] Criar conta gratuita
- [ ] Confirmar email

### Criar Aplicação
- [ ] Clicar em "Criar Nova Aplicação"
- [ ] Tipo: **Node.js**
- [ ] Plano: **Node 1** (R$ 19/mês)
- [ ] Nome: `seu-delivery` (escolha um)

### Conectar Git
- [ ] Aba "Deploy" → "Conectar Repositório Git"
- [ ] Autorizar GitHub
- [ ] Selecionar repositório
- [ ] Branch: `main`

---

## 4️⃣ Configurar Variáveis de Ambiente

Na aba **"Variáveis de Ambiente"** da Umbler, adicionar:

```env
PORT=3001
NODE_ENV=production
ADMIN_USER=admin
ADMIN_PASS=TROCAR_SENHA_AQUI
SESSION_SECRET=GERAR_CHAVE_ALEATORIA
WHATSAPP_API_KEY=GERAR_CHAVE_ALEATORIA
```

**🔐 Gerar senhas seguras:** https://passwordsgenerator.net/

- [ ] PORT configurado
- [ ] NODE_ENV = production
- [ ] ADMIN_USER configurado
- [ ] ADMIN_PASS configurado (senha FORTE!)
- [ ] SESSION_SECRET configurado (chave aleatória)
- [ ] WHATSAPP_API_KEY configurado (chave aleatória)

---

## 5️⃣ Configurar Build

Na aba **"Build"** da Umbler:

- **Comando de Build:** `npm install && npm run build`
- **Comando de Start:** `npm start`
- **Diretório:** `/` (raiz)

- [ ] Comandos configurados
- [ ] Deploy automático ativado

---

## 6️⃣ Primeiro Deploy

- [ ] Umbler faz deploy automaticamente
- [ ] Aguardar 3-5 minutos
- [ ] Verificar logs (aba "Logs")
- [ ] Site acessível em `https://seu-app.umbler.app`

---

## 7️⃣ Configurar WhatsApp

- [ ] Acessar `https://seu-app.umbler.app/whatsapp/qr`
- [ ] Escanear QR Code com WhatsApp da empresa
- [ ] Aguardar conectar (até 2 min)
- [ ] Verificar "WhatsApp conectado!"

---

## 8️⃣ Configurar Painel Admin

- [ ] Acessar `https://seu-app.umbler.app/painel-admin.html`
- [ ] Login: usar `ADMIN_USER` e `ADMIN_PASS`
- [ ] Aba "Dashboard" → Configurar:
  - Nome da empresa
  - WhatsApp (mesmo número conectado)
  - Endereço
  - Horário de funcionamento
  - Logo/banner (se tiver)

---

## 9️⃣ Configurar Cardápio

- [ ] Aba "Meus itens" → Adicionar produtos
- [ ] Adicionar fotos dos produtos
- [ ] Configurar preços
- [ ] Ativar/desativar itens conforme necessário

---

## 🔟 Testar Sistema

- [ ] Fazer pedido de teste pelo site
- [ ] Verificar se WhatsApp recebeu notificação
- [ ] Confirmar pedido no painel admin
- [ ] Verificar status no site (aba "Pedidos")

---

## 🎯 Deploy Futuro

Sempre que fizer alterações:

```bash
git add .
git commit -m "Descrição da alteração"
git push origin main
```

A Umbler faz deploy automático!

---

## ⚠️ Importante

### Backup dos Dados
Os arquivos JSON são efêmeros. Faça backup periodicamente:
- Baixe `_backup/*.json` pelo FTP/SFTP da Umbler
- Ou salve via painel admin

### Monitoramento
- Verifique logs diariamente
- Acompanhe pedidos pelo painel
- Mantenha WhatsApp conectado

---

## 🆘 Problemas?

**WhatsApp desconectou:**
- Reconectar em `/whatsapp/qr`

**Site não carrega:**
- Verificar logs na Umbler
- Conferir variáveis de ambiente

**Erro 502/504:**
- Aguardar 1-2 minutos (servidor iniciando)

**Admin não loga:**
- Verificar `ADMIN_USER` e `ADMIN_PASS`
- Limpar cookies do navegador

---

## ✅ Conclusão

- [ ] Sistema no ar
- [ ] WhatsApp conectado
- [ ] Admin configurado
- [ ] Cardápio atualizado
- [ ] Pedido de teste realizado

**🎉 Seu delivery está funcionando!**

**URL do site:** `https://seu-app.umbler.app`
