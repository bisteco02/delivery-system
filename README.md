# Sistema de Delivery

Sistema completo de delivery com painel administrativo e integração WhatsApp.

## 🚀 Deploy na Umbler

**Veja o guia completo:** [DEPLOY.md](DEPLOY.md)

## 💻 Rodar Localmente

### 1. Instalar dependências
```bash
npm install
```

### 2. Criar arquivo .env
```bash
cp .env.example .env
```

### 3. Iniciar servidor
```bash
npm start
```

Acesse: **http://localhost:3001**

## 📍 URLs

- **Site:** http://localhost:3001/index.html
- **Painel Admin:** http://localhost:3001/painel-admin.html
- **WhatsApp QR:** http://localhost:3001/whatsapp/qr

## 🔒 Configuração de Segurança do Painel Admin

O painel admin agora usa um sistema de login seguro com sessões. Para cada empresa, configure as credenciais personalizadas.

### 1. Configurar Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env` e personalize:

```bash
cp .env.example .env
```

Edite o `.env` com suas configurações:

```env
# Domínio exclusivo para acesso direto (opcional)
ADMIN_DOMAIN=empresa-delivery.com

# Credenciais de login (personalize para cada empresa)
ADMIN_USER=admin_empresa
ADMIN_PASS=senha_super_segura_123

# Token para bypass (APIs, integrações)
ADMIN_TOKEN=token-unico-empresa

# Segredo para sessões (mantenha seguro)
SESSION_SECRET=chave-secreta-unica-2026
```

### 2. Acesso ao Painel

- **Login:** Acesse `https://seudominio.com/login` e faça login com usuário/senha.
- **Domínio Exclusivo:** Se `ADMIN_DOMAIN` estiver definido, o acesso direto ao painel é permitido apenas desse domínio.
- **Token de Bypass:** Use `X-Admin-Token` no header ou `?admin_token=` na URL para acesso programático.
- **Logout:** Acesse `/logout` para encerrar a sessão.

### 3. Produção (HTTPS Obrigatório)

Em produção (`NODE_ENV=production`), o servidor força HTTPS automaticamente.

### Credenciais Padrão (Desenvolvimento)
- **Usuário:** admin
- **Senha:** admin123

⚠️ **Importante:** Sempre personalize as credenciais no `.env` antes de colocar em produção!

### WhatsApp API
- **API Key:** padoca-local-2026

## 📱 WhatsApp (Opcional)

Para usar a integração WhatsApp, instale o Chrome do Puppeteer:

```bash
npx puppeteer browsers install chrome
```

Depois reinicie o servidor e acesse http://localhost:3001/whatsapp/qr para escanear o QR Code.

## 🛠️ Desenvolvimento

Para editar estilos com Tailwind em modo watch:

```bash
npm run dev
```

## 📁 Estrutura

```
├── server.js              # Servidor principal (Express + WhatsApp API)
├── index.html             # Site da padaria
├── painel-admin.html      # Painel administrativo
├── painel-admin.js        # Lógica do painel
├── _backup/               # Arquivos JSON (pedidos, cardápio, etc)
├── assets/                # Imagens dos produtos
├── uploads/               # Upload de imagens
└── styles/                # CSS/Tailwind
```

## 🔌 API Endpoints

### Pedidos
- `POST /api/pedidos` - Criar pedido
- `GET /api/pedidos` - Listar pedidos do dia
- `PATCH /api/pedidos/:id` - Atualizar status

### Cardápio
- `GET /api/cardapio` - Obter cardápio
- `POST /api/cardapio` - Atualizar cardápio

### WhatsApp
- `GET /whatsapp/status` - Status da conexão
- `POST /whatsapp/send` - Enviar mensagem (requer API Key)

### Outros
- `POST /api/login` - Login admin
- `GET/POST /api/company-data` - Dados da empresa
- `GET/POST /api/promotions` - Promoções
- `POST /api/upload-image` - Upload de imagem

## 📦 Tecnologias

- **Backend:** Node.js + Express
- **Frontend:** HTML/CSS/JavaScript + Tailwind CSS
- **Database:** Arquivos JSON
- **WhatsApp:** whatsapp-web.js

## 💼 Venda do Produto

Este projeto está pronto para ser vendido como solução completa para empresas de delivery de padaria. Cada cliente pode personalizar:

### Como Entregar para Clientes
1. **Forneça o Código Completo:** Envie todo o repositório (exceto `.env` com dados reais).
2. **Instruções de Setup:** Oriente o cliente a:
   - Copiar `.env.example` para `.env`
   - Configurar `ADMIN_DOMAIN`, `ADMIN_USER`, `ADMIN_PASS` com valores únicos
   - Hospedar em provedor com suporte a Node.js (Heroku, Vercel, DigitalOcean, etc.)
   - Configurar domínio e HTTPS
3. **Personalização:** O cliente pode editar textos, cores e funcionalidades conforme necessidade.

### Benefícios para Venda
- ✅ **Seguro:** Autenticação robusta com sessões e HTTPS obrigatório
- ✅ **Escalável:** Fácil de configurar por empresa
- ✅ **Completo:** Site + Admin + WhatsApp integrado
- ✅ **Pronto para Produção:** Apenas configurar variáveis e hospedar

Para mais detalhes, consulte o `.env.example` e as configurações acima.
