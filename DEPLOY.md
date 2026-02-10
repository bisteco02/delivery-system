# Guia de Deploy - Umbler

## 📋 Pré-requisitos

1. Conta na Umbler: https://www.umbler.com/
2. Git instalado localmente
3. Repositório Git criado (GitHub/GitLab/Bitbucket)

---

## 🚀 Passo a Passo

### 1. Preparar o Projeto Localmente

```bash
# Navegar até a pasta do projeto
cd C:\Users\Mm\Desktop\PadocaSite2

# Inicializar repositório Git (se ainda não tiver)
git init

# Adicionar todos os arquivos
git add .

# Fazer commit inicial
git commit -m "Deploy inicial"
```

### 2. Criar Repositório no GitHub

1. Acesse https://github.com/new
2. Crie um repositório **privado**
3. Copie a URL do repositório (ex: https://github.com/seu-usuario/padoca-delivery.git)

```bash
# Conectar repositório local ao GitHub
git remote add origin https://github.com/seu-usuario/padoca-delivery.git

# Enviar código
git branch -M main
git push -u origin main
```

### 3. Configurar na Umbler

#### 3.1. Criar Aplicação Node.js

1. Faça login na Umbler
2. Clique em **"Criar Nova Aplicação"**
3. Selecione **"Node.js"**
4. Escolha o plano **Node 1** (R$ 19/mês)
5. Dê um nome (ex: `padoca-delivery`)

#### 3.2. Conectar ao Git

1. Na dashboard da aplicação, vá em **"Deploy"**
2. Clique em **"Conectar Repositório Git"**
3. Autorize acesso ao GitHub
4. Selecione seu repositório
5. Branch: `main`

#### 3.3. Configurar Variáveis de Ambiente

Na aba **"Variáveis de Ambiente"**, adicione:

```
PORT=3001
NODE_ENV=production
ADMIN_USER=admin
ADMIN_PASS=SEU_SENHA_SEGURA
SESSION_SECRET=GERE_UM_TEXTO_ALEATORIO_AQUI
WHATSAPP_API_KEY=GERE_UMA_CHAVE_ALEATORIA
```

**⚠️ IMPORTANTE:** Troque `SEU_SENHA_SEGURA` e as chaves por valores seguros!

#### 3.4. Configurar Build

Na aba **"Build"**:
- **Comando de Build**: `npm install && npm run build`
- **Comando de Start**: `npm start`
- **Diretório da Aplicação**: `/` (raiz)

### 4. Deploy Automático

A Umbler fará deploy automaticamente quando você:

```bash
# Fazer alterações
git add .
git commit -m "Descrição das alterações"
git push origin main
```

---

## 🔧 Configurações Pós-Deploy

### Configurar WhatsApp

1. Acesse `https://seu-app.umbler.app/whatsapp/qr`
2. Escaneie o QR Code com o WhatsApp da empresa
3. Aguarde conectar

### Acessar Painel Admin

1. Acesse `https://seu-app.umbler.app/painel-admin.html`
2. Login: `admin`
3. Senha: A que você configurou em `ADMIN_PASS`

### Configurar Dados da Empresa

1. No painel admin, vá em **"Dashboard"**
2. Configure:
   - Nome da empresa
   - WhatsApp
   - Endereço
   - Horário de funcionamento

---

## 📦 Persistência de Dados

### ⚠️ IMPORTANTE: Arquivos JSON

Os arquivos JSON (`_backup/*.json`) são efêmeros na Umbler. A cada novo deploy, eles são resetados.

#### Solução 1: Usar Banco de Dados (Recomendado para produção)

Migrar de JSON para MongoDB/PostgreSQL quando o negócio crescer.

#### Solução 2: Backup Manual

Baixe os arquivos JSON periodicamente:
- `https://seu-app.umbler.app/api/cardapio`
- `https://seu-app.umbler.app/api/pedidos`

---

## 🔒 Segurança

### Gerar Senhas Seguras

Use este site para gerar chaves aleatórias:
https://passwordsgenerator.net/

Exemplo de configuração segura:
```
ADMIN_PASS=Xk9#mP2$vL8qR
SESSION_SECRET=aB3$xZ9*nM5pQ2wE7rT4yU
WHATSAPP_API_KEY=vN8$bM3pL9xK2qW5eR7tY
```

---

## 🛠️ Problemas Comuns

### WhatsApp não conecta
- Verifique se o QR Code está válido
- Certifique-se de que o WhatsApp não está conectado em outro lugar
- A sessão pode levar até 2 minutos para conectar

### Site não carrega
- Verifique os logs na Umbler (aba "Logs")
- Confirme que `NODE_ENV=production`
- Verifique se `PORT` está configurado

### Admin não loga
- Confirme que `ADMIN_USER` e `ADMIN_PASS` estão corretos
- Limpe o cache do navegador

---

## 📞 Suporte

- Umbler: https://www.umbler.com/br/ajuda
- Documentação Node.js: https://help.umbler.com/hc/pt-br/articles/360009344034

---

## 🎯 Checklist Final

- [ ] Código enviado para GitHub
- [ ] Aplicação criada na Umbler
- [ ] Variáveis de ambiente configuradas
- [ ] Deploy realizado com sucesso
- [ ] WhatsApp conectado
- [ ] Painel admin acessível
- [ ] Dados da empresa configurados
- [ ] Cardápio atualizado
- [ ] Teste de pedido realizado

**✅ Seu sistema está no ar!**
