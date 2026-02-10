# ✅ Checklist - Hostinger VPS

## 📋 Fase 1: Contratar e Acessar

- [ ] Acessar https://www.hostinger.com.br/
- [ ] Contratar VPS KVM 1 (R$ 19,99/mês)
- [ ] Escolher Ubuntu 22.04 LTS
- [ ] Localização: São Paulo
- [ ] Receber email com dados de acesso
- [ ] Salvar IP, usuário e senha em local seguro

---

## 🔐 Fase 2: Conectar SSH

- [ ] Abrir PowerShell
- [ ] Executar: `ssh root@SEU_IP`
- [ ] Confirmar com `yes`
- [ ] Colar senha (não aparece digitação)
- [ ] Estar logado no servidor (prompt diferente)

---

## 🛡️ Fase 3: Segurança

- [ ] Trocar senha root: `passwd`
- [ ] Criar usuário novo: `adduser seu_usuario`
- [ ] Dar permissões: `usermod -aG sudo seu_usuario`
- [ ] Logar no novo usuário: `su seu_usuario`

---

## 🚀 Fase 4: Instalar Node.js

- [ ] Atualizar sistema: `sudo apt update && sudo apt upgrade -y`
- [ ] Instalar Node.js (curl + setup)
- [ ] Verificar: `node --version` (deve mostrar v18.x.x)
- [ ] Verificar: `npm --version` (deve mostrar versão)

---

## 📦 Fase 5: Git e Projeto

- [ ] Instalar Git: `sudo apt install -y git`
- [ ] Configurar nome: `git config --global user.name "Seu Nome"`
- [ ] Configurar email: `git config --global user.email "seu@email.com"`
- [ ] Criar pasta: `mkdir -p /home/seu_usuario/app`
- [ ] Navegar: `cd /home/seu_usuario/app`
- [ ] Clonar repo: `git clone https://github.com/bisteco02/delivery-system.git`
- [ ] Entrar pasta: `cd delivery-system`
- [ ] Instalar deps: `npm install` (esperar terminar)
- [ ] Testar: `npm start` (deve rodar sem erros)

---

## ⚙️ Fase 6: PM2 (Process Manager)

- [ ] Instalar PM2: `sudo npm install -g pm2`
- [ ] Iniciar app: `pm2 start server.js --name "delivery-system"`
- [ ] Verificar status: `pm2 status` (deve mostrar **online**)
- [ ] Ver logs: `pm2 logs delivery-system`
- [ ] Configurar auto-start: `pm2 startup`
- [ ] Salvar: `pm2 save`

---

## 🌐 Fase 7: Nginx

- [ ] Instalar: `sudo apt install -y nginx`
- [ ] Criar config: `sudo nano /etc/nginx/sites-available/delivery`
- [ ] Colar configuração de proxy (ver guia)
- [ ] Ativar config: `sudo ln -s /etc/nginx/sites-available/delivery /etc/nginx/sites-enabled/`
- [ ] Remover default: `sudo rm /etc/nginx/sites-enabled/default`
- [ ] Testar: `sudo nginx -t` (deve mostrar **successful**)
- [ ] Reiniciar: `sudo systemctl restart nginx`

---

## 🔑 Fase 8: Variáveis de Ambiente

- [ ] Criar .env: `nano /home/seu_usuario/app/delivery-system/.env`
- [ ] Colar variáveis (PORT, NODE_ENV, ADMIN_USER, etc)
- [ ] Salvar com `Ctrl+X` → `Y` → `Enter`
- [ ] Reiniciar app: `pm2 restart delivery-system`

---

## 🧪 Fase 9: Testar

- [ ] Abrir navegador
- [ ] Acessar: `http://SEU_IP` (substituir IP real)
- [ ] Ver site carregando ✅
- [ ] Acessar: `http://SEU_IP/painel-admin.html`
- [ ] Admin carrega ✅
- [ ] Acessar: `http://SEU_IP/whatsapp/qr`
- [ ] QR code aparece ✅

---

## 📱 Fase 10: WhatsApp

- [ ] Ir em `http://SEU_IP/whatsapp/qr`
- [ ] Escanear QR com WhatsApp da empresa
- [ ] Aguardar 2 minutos para conectar
- [ ] Verificar em painel se conectou
- [ ] Testar envio de mensagem

---

## 🎓 Aprendizado (Bônus)

- [ ] Entender SSH e conexão remota
- [ ] Conhecer estrutura Linux (apt, sudo, user)
- [ ] Instalar e configurar Node.js em produção
- [ ] Usar PM2 para gerenciar processos
- [ ] Configurar Nginx como reverse proxy
- [ ] Entender variáveis de ambiente em produção
- [ ] Trabalhar com domínios (opcional depois)
- [ ] Configurar SSL/HTTPS (optional depois)

---

## 📚 Comandos Importantes (Guarde)

```bash
# Conectar
ssh seu_usuario@SEU_IP

# Ver status
pm2 status

# Ver logs
pm2 logs delivery-system

# Restart
pm2 restart delivery-system

# Atualizar código
cd /home/seu_usuario/app/delivery-system
git pull origin main
npm install
pm2 restart delivery-system

# Checar disco
df -h

# Checar CPU/RAM
top
```

---

## ✅ Conclusão

- [ ] Sistema rodando 24/7 no VPS
- [ ] WhatsApp conectado
- [ ] Admin funciona
- [ ] Aprendeu Linux, Node.js e DevOps
- [ ] Pode colocar no currículo!

**🎉 Parabéns! Você é um DevOps agora!**
