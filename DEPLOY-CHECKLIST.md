# 🚀 Checklist de Deploy em Produção

## ✅ Antes de Hospedar

### Segurança

- [ ] Trocar senha do super admin em `server-multitenant.js` (linha ~435)
- [ ] Trocar token do super admin (linha ~433)
- [ ] Adicionar bcrypt para senhas (ao invés de MD5)
- [ ] Configurar HTTPS/SSL
- [ ] Adicionar rate limiting (evitar ataques)
- [ ] Adicionar helmet.js para segurança
- [ ] Validar inputs (evitar SQL injection)

### Banco de Dados

- [ ] Configurar backups automáticos
- [ ] Considerar migrar para PostgreSQL/MySQL (opcional)
- [ ] Testar restauração de backup
- [ ] Configurar índices para performance

### Performance

- [ ] Minificar CSS/JS
- [ ] Otimizar imagens (WebP, compressão)
- [ ] Configurar cache de assets
- [ ] Adicionar CDN para imagens
- [ ] Configurar compression middleware

### Funcionalidades

- [ ] Testar cadastro de tenant
- [ ] Testar login super admin
- [ ] Testar todas as APIs
- [ ] Testar upload de imagens
- [ ] Validar isolamento entre tenants

## 🌐 Deploy na Hostinger VPS

### 1. Contratar VPS

**Plano Recomendado:**
- 2-4GB RAM
- 2 vCPUs
- 50GB SSD
- Ubuntu 20.04/22.04

**Custo:** ~R$ 30-80/mês

### 2. Conectar via SSH

```bash
ssh root@SEU_IP
```

### 3. Instalar Node.js

```bash
# Atualizar sistema
apt update && apt upgrade -y

# Instalar Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Verificar
node -v
npm -v
```

### 4. Instalar PM2

```bash
npm install -g pm2
```

### 5. Enviar Arquivos

**Opção A: Git (recomendado)**
```bash
# No servidor
cd /var/www
git clone SEU_REPOSITORIO padoca
cd padoca
npm install
```

**Opção B: FileZilla/SFTP**
- Conecte via SFTP
- Envie todos os arquivos para `/var/www/padoca`

### 6. Configurar Variáveis de Ambiente

```bash
nano .env
```

Adicione:
```
PORT=3001
NODE_ENV=production
DATABASE_URL=sqlite://./padoca_platform.db
SUPER_ADMIN_PASSWORD=SENHA_FORTE_AQUI
```

### 7. Iniciar com PM2

```bash
cd /var/www/padoca
pm2 start server-multitenant.js --name padoca-platform
pm2 save
pm2 startup
```

### 8. Configurar Nginx

```bash
apt install nginx -y
nano /etc/nginx/sites-available/padoca
```

Adicione:
```nginx
server {
    listen 80;
    server_name seudominio.com.br www.seudominio.com.br;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/padoca /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### 9. Configurar SSL (HTTPS)

```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d seudominio.com.br -d www.seudominio.com.br
```

### 10. Configurar Firewall

```bash
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
```

## 🚀 Deploy no Railway (Mais Fácil)

### 1. Criar Conta
- Acesse [railway.app](https://railway.app)
- Faça login com GitHub

### 2. Novo Projeto
- Clique em "New Project"
- Selecione "Deploy from GitHub repo"

### 3. Conectar Repositório
- Autorize Railway no GitHub
- Selecione seu repositório

### 4. Configurar
- Railway detecta Node.js automaticamente
- Adicione variável de ambiente: `PORT=3001`

### 5. Deploy
- Railway faz deploy automático
- Você recebe uma URL: `seu-app.railway.app`

### 6. Domínio Personalizado
- Settings → Domains
- Adicione seu domínio
- Configure DNS (CNAME)

**Custo:** ~$5-20/mês

## 🎯 Configurar Domínio

### Na Hostinger/Registro.br

1. **DNS Records:**

```
A     @       SEU_IP_VPS
A     www     SEU_IP_VPS
```

ou (se Railway):

```
CNAME @       seu-app.railway.app
CNAME www     seu-app.railway.app
```

2. **Esperar Propagação:** 1-24h

## 💰 Sistema de Pagamentos

### Integrar com Mercado Pago

1. **Cadastrar em:** https://www.mercadopago.com.br

2. **Obter Credenciais:**
   - Access Token
   - Public Key

3. **Instalar SDK:**
```bash
npm install mercadopago
```

4. **Criar Assinaturas:**
```javascript
const mercadopago = require('mercadopago');
mercadopago.configure({
  access_token: 'SEU_TOKEN'
});

// Criar plano
const preapproval = {
  reason: 'Plano Profissional - PadocaOnline',
  auto_recurring: {
    frequency: 1,
    frequency_type: 'months',
    transaction_amount: 99,
    currency_id: 'BRL'
  },
  back_url: 'https://seusite.com/obrigado',
  payer_email: 'cliente@email.com'
};
```

### Webhooks para Notificações

```javascript
app.post('/webhook/mercadopago', async (req, res) => {
  const { type, data } = req.body;
  
  if (type === 'payment') {
    // Atualizar status do tenant
    const payment = await mercadopago.payment.get(data.id);
    
    if (payment.status === 'approved') {
      // Ativar/renovar conta
      await dbRun(`
        UPDATE tenants 
        SET ativo = 1, data_expiracao = datetime('now', '+30 days')
        WHERE id = ?
      `, [payment.external_reference]);
    }
  }
  
  res.sendStatus(200);
});
```

## 📊 Monitoramento

### Logs
```bash
# Ver logs do PM2
pm2 logs padoca-platform

# Monitorar em tempo real
pm2 monit
```

### Uptime Monitoring
- Use [UptimeRobot](https://uptimerobot.com) (grátis)
- Monitora se o site está no ar
- Envia alerta se cair

### Analytics
- Google Analytics
- Hotjar (grátis)
- Mixpanel

## 🔄 Atualização

### Atualizar Código

```bash
cd /var/www/padoca
git pull origin main
npm install
pm2 restart padoca-platform
```

### Backup Antes de Atualizar

```bash
cp padoca_platform.db backups/backup-$(date +%Y%m%d-%H%M%S).db
```

## 📱 Marketing

### SEO Básico

Em todas as páginas HTML, adicione:
```html
<meta name="description" content="Cardápio digital para padarias - Crie seu site em minutos">
<meta name="keywords" content="cardápio digital, padaria online, menu digital">
<meta property="og:title" content="PadocaOnline - Cardápio Digital">
<meta property="og:image" content="/logo.png">
```

### Google My Business
- Cadastre seu negócio
- Apareça no Google Maps
- Colete avaliações

### Facebook Ads
- Público: Donos de padarias
- Localização: Sua cidade/região
- Orçamento: R$ 10-30/dia

### Script de Vendas

"Olá! Você sabia que 70% dos clientes pesquisam cardápios online antes de visitar? Eu criei um sistema que coloca sua padaria na internet em 10 minutos, com cardápio digital e pedidos pelo WhatsApp. Custa menos que uma cesta básica por mês (R$ 99). Posso mostrar uma demo?"

## ✅ Checklist Final

Antes de considerar pronto:

- [ ] Site acessível pelo domínio
- [ ] HTTPS funcionando (cadeado verde)
- [ ] Cadastro de novos tenants funcionando
- [ ] Login super admin funcionando
- [ ] Upload de imagens funcionando
- [ ] Pedidos sendo salvos
- [ ] Backup automático configurado
- [ ] Monitoramento ativo
- [ ] Email de suporte configurado
- [ ] Termos de uso e política de privacidade
- [ ] LGPD em conformidade
- [ ] Sistema de pagamento testado
- [ ] 3 clientes beta testando

## 🎉 Pronto para Lucrar!

Após completar este checklist, você terá:
- ✅ Plataforma online e segura
- ✅ Sistema de pagamentos funcionando
- ✅ Monitoramento ativo
- ✅ Pronto para vender!

**Meta inicial:** 10 clientes = R$ 990/mês

**Em 6 meses:** 50 clientes = R$ 4.950/mês

**Em 1 ano:** 100 clientes = R$ 9.900/mês

🚀 **Boa sorte com seu SaaS!**
