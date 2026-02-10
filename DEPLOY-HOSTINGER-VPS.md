# 🚀 Deploy no Hostinger VPS - Guia Completo

## 📋 Pré-requisitos

✅ Código no GitHub: `https://github.com/bisteco02/delivery-system` (já tem!)
✅ Repositório local configurado (já tem!)

---

## 1️⃣ Contratar Hostinger VPS

### Passo 1.1: Acessar Hostinger
- Acesse: **https://www.hostinger.com.br/**
- Clique em **"VPS"** no menu
- Selecione **"VPS KVM 1"** (R$ 19,99/mês)

### Passo 1.2: Configurar
- Escolha localização: **São Paulo (Brasil)**
- SO: **Ubuntu 22.04 LTS** (recomendado)
- Período: **Mensal**
- Checkout

### Passo 1.3: Dados de Acesso
Você receberá por email:
- **IP do servidor** (ex: 123.45.67.89)
- **Usuário**: root
- **Senha**: (salve em local seguro!)
- **Porta SSH**: 22

**Guarde esses dados!**

---

## 2️⃣ Conectar ao VPS via SSH

### No PowerShell (seu computador):

```powershell
ssh root@SEU_IP_AQUI
```

Exemplo:
```powershell
ssh root@123.45.67.89
```

**Primeira vez:**
- Digite `yes` quando pedir confirmação
- Cole a **senha** que recebeu (não aparece digitação)

**Pronto! Você está conectado ao servidor.**

---

## 3️⃣ Configurar Segurança Básica

### Passo 3.1: Trocar Senha Root
```bash
passwd
```
Digite uma **senha forte e diferente** da anterior.

### Passo 3.2: Criar Usuário Novo (Recomendado)
```bash
adduser seu_usuario
```
Digite uma senha forte quando pedir.

### Passo 3.3: Dar Permissões de Admin
```bash
usermod -aG sudo seu_usuario
```

### Passo 3.4: Logar no Novo Usuário
```bash
su seu_usuario
```

**Daqui pra frente, você usa o novo usuário (mais seguro que root).**

---

## 4️⃣ Instalar Node.js

### Passo 4.1: Atualizar Sistema
```bash
sudo apt update
sudo apt upgrade -y
```
Pode demorar alguns minutos. Deixa rodar.

### Passo 4.2: Instalar Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### Passo 4.3: Verificar Instalação
```bash
node --version
npm --version
```
Deve mostrar versão. Se mostrar, funcionou! ✅

---

## 5️⃣ Instalar e Configurar Git

### Passo 5.1: Instalar Git
```bash
sudo apt install -y git
```

### Passo 5.2: Configurar Identidade
```bash
git config --global user.name "Seu Nome"
git config --global user.email "seu@email.com"
```

---

## 6️⃣ Clonar Seu Projeto do GitHub

### Passo 6.1: Criar Pasta do Projeto
```bash
mkdir -p /home/seu_usuario/app
cd /home/seu_usuario/app
```

### Passo 6.2: Clonar Repositório
```bash
git clone https://github.com/bisteco02/delivery-system.git
cd delivery-system
```

### Passo 6.3: Instalar Dependências
```bash
npm install
```
Pode demorar 5-10 minutos. Deixa terminar.

### Passo 6.4: Testar Localmente
```bash
npm start
```

Se rodar sem erros, é sinal de que tá tudo certo no servidor também!

Pressione `Ctrl + C` para parar.

---

## 7️⃣ Instalar e Configurar PM2

PM2 é um "gerenciador de processos" que mantém seu app rodando 24/7.

### Passo 7.1: Instalar PM2
```bash
sudo npm install -g pm2
```

### Passo 7.2: Iniciar App com PM2
```bash
pm2 start server.js --name "delivery-system"
```

### Passo 7.3: Verificar Status
```bash
pm2 status
```
Deve mostrar **online** (verde). Se mostrar **stopped** (vermelho), tem erro.

### Passo 7.4: Ver Logs
```bash
pm2 logs delivery-system
```
Pressione `Ctrl + C` para sair dos logs.

### Passo 7.5: Auto-iniciar no Boot
```bash
pm2 startup
pm2 save
```

Agora, se o servidor reiniciar, seu app inicia automaticamente! ✅

---

## 8️⃣ Instalar Nginx (Reverse Proxy)

Nginx é um servidor web que fica na frente do Node.js.

### Passo 8.1: Instalar Nginx
```bash
sudo apt install -y nginx
```

### Passo 8.2: Criar Configuração
```bash
sudo nano /etc/nginx/sites-available/delivery
```

Cole isto (ajuste o IP interno se necessário):
```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Como salvar:**
- Pressione `Ctrl + X`
- Digite `Y` (yes)
- Pressione `Enter`

### Passo 8.3: Ativar Configuração
```bash
sudo ln -s /etc/nginx/sites-available/delivery /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
```

### Passo 8.4: Testar Configuração
```bash
sudo nginx -t
```
Deve mostrar `successful` (sucesso).

### Passo 8.5: Reiniciar Nginx
```bash
sudo systemctl restart nginx
```

---

## 9️⃣ Configurar Variáveis de Ambiente

### Passo 9.1: Criar .env no Servidor
```bash
nano /home/seu_usuario/app/delivery-system/.env
```

Cole isto (adapte com suas senhas):
```env
PORT=3001
NODE_ENV=production
ADMIN_USER=admin
ADMIN_PASS=senha_muito_forte_123
SESSION_SECRET=chave_aleatoria_muito_longa_aqui
WHATSAPP_API_KEY=outra_chave_aleatoria_aqui
```

**Gerar senhas fortes:** https://passwordsgenerator.net/

Salve com `Ctrl + X` → `Y` → `Enter`.

### Passo 9.2: Reiniciar App
```bash
pm2 restart delivery-system
```

---

## 🔟 Acessar Seu Site

### Seu IP + Porta 80:
```
http://SEU_IP:80
```

Exemplo:
```
http://123.45.67.89
```

**Se vir o site, FUNCIONOU! 🎉**

---

## 1️⃣1️⃣ Registrar Domínio (Opcional)

Se quiser `seu-delivery.com` ao invés de IP:

1. Acesse **https://www.hostinger.com.br/** (domínios)
2. Registre seu domínio
3. Configure DNS para apontar pro IP do VPS
4. Aguarde 24h para propagar

---

## 1️⃣2️⃣ SSL/HTTPS (Recomendado)

Para transformar `http` em `https` seguro:

### Instalar Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Gerar Certificado (com seu IP ou domínio)
```bash
sudo certbot --nginx -d seu-dominio.com
```

Ou se tiver domínio:
```bash
sudo certbot --nginx -d seu-dominio.com -d www.seu-dominio.com
```

Responda as perguntas e pronto! SSL configurado automático.

---

## 🆘 Comandos Úteis

### Conectar via SSH
```bash
ssh seu_usuario@SEU_IP
```

### Ver Status do App
```bash
pm2 status
```

### Ver Logs
```bash
pm2 logs delivery-system
```

### Reiniciar App
```bash
pm2 restart delivery-system
```

### Parar App
```bash
pm2 stop delivery-system
```

### Atualizar Código do GitHub
```bash
cd /home/seu_usuario/app/delivery-system
git pull origin main
npm install
pm2 restart delivery-system
```

### Verificar Espaço em Disco
```bash
df -h
```

### Ver Uso de CPU/RAM
```bash
top
```
(Pressione `Q` para sair)

---

## 🔐 WhatsApp QR Code

Após tudo estar rodando, acesse:

```
http://SEU_IP/whatsapp/qr
```

Escaneie o QR Code com o WhatsApp da empresa.

---

## ✅ Checklist Final

- [ ] Servidor contratado na Hostinger
- [ ] Conectou via SSH
- [ ] Node.js instalado (`node --version` funciona)
- [ ] Git configurado
- [ ] Projeto clonado do GitHub
- [ ] `npm install` rodou sem erros
- [ ] PM2 instalado e app rodando
- [ ] Nginx configurado e testado
- [ ] `.env` criado com variáveis
- [ ] Site acessível em `http://SEU_IP`
- [ ] Painel admin funciona em `http://SEU_IP/painel-admin.html`
- [ ] WhatsApp QR code acessível

---

## 🎯 Pronto!

Seu delivery está rodando 24/7 em um VPS real. Parabéns! 🚀

Qualquer erro, me chama!
