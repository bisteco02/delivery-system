# Backend - Padoca do Dedé

## 🚀 Como Iniciar o Backend

### 1. Instalar Dependências
As dependências já estão instaladas, mas caso precise reinstalar:
```bash
npm install
```

### 2. Iniciar o Servidor
```bash
node server.js
```

O servidor vai iniciar em: **http://localhost:3001**

Você verá a mensagem:
```
🚀 Servidor rodando em http://localhost:3001
📦 Pedidos salvos em: C:\Users\...\pedidos.json
```

### 3. Testar o Sistema

1. **Inicie o servidor**: `node server.js`
2. **Abra o site**: Abra `index.html` no navegador
3. **Faça um pedido**:
   - Adicione itens ao carrinho
   - Clique em "Finalizar Pedido"
   - Preencha os dados
   - Clique em "Finalizar Pedido"
4. **Visualize os pedidos**: Abra `painel-admin.html` no navegador

---

## 📋 Arquivos Criados

### **server.js** - Servidor Backend
- Roda na porta 3001
- Salva pedidos em `pedidos.json`
- API REST com rotas:
  - `POST /api/pedidos` - Criar novo pedido
  - `GET /api/pedidos` - Listar todos os pedidos
  - `GET /api/pedidos/:whatsapp` - Listar pedidos de um cliente
  - `PATCH /api/pedidos/:id` - Atualizar status do pedido

### **painel-admin.html** - Painel Admin
- Visualizar todos os pedidos
- Filtrar por status (Pendente, Confirmado, Entregue, Cancelado)
- Atualizar status dos pedidos
- Atualização automática a cada 30 segundos

### **pedidos.json** - Banco de Dados
- Criado automaticamente quando o servidor inicia
- Armazena todos os pedidos em formato JSON
- Cada pedido contém:
  - ID único
  - Dados do cliente (nome, WhatsApp)
  - Itens do pedido
  - Endereço de entrega
  - Taxa de entrega
  - Status (pendente, confirmado, entregue, cancelado)
  - Data e hora do pedido

---

## 🔧 Configurações Importantes

### Número do WhatsApp
Atualize o número do WhatsApp em **checkout.html** (linha ~274):
```javascript
const whatsappUrl = `https://wa.me/5563999999999?text=${encodedMessage}`;
```
Substitua `5563999999999` pelo número real da padoca.

### Porta do Servidor
Se precisar mudar a porta, edite em **server.js** (linha 6):
```javascript
const PORT = 3001; // Mude para outra porta se necessário
```

---

## 📊 Estrutura de um Pedido

```json
{
  "id": "1737324567890",
  "cliente": {
    "nome": "João Silva",
    "whatsapp": "(63) 99999-9999"
  },
  "itens": [
    {
      "nome": "MIRANDA PRIESTLY - (Margherita) - 8 pedaços",
      "quantidade": 1,
      "precoUnitario": 45.00,
      "precoTotal": 45.00,
      "bebida": "Coca Cola 2L",
      "adicionais": [],
      "observacoes": "",
      "imagem": "./assets/Margherita.png"
    }
  ],
  "total": 50.00,
  "endereco": "Rua 20, Quadra 18, Lote 14",
  "bairro": "Universitário",
  "taxaEntrega": 5.00,
  "tipoEntrega": "delivery",
  "observacoes": "",
  "status": "pendente",
  "data": "2026-01-19T15:30:00.000Z"
}
```

---

## ✅ Checklist de Funcionamento

- [ ] Servidor rodando (`node server.js`)
- [ ] Site abre normalmente (`index.html`)
- [ ] Consegue adicionar itens ao carrinho
- [ ] Consegue finalizar pedido
- [ ] Pedido é salvo em `pedidos.json`
- [ ] Painel admin mostra os pedidos (`painel-admin.html`)
- [ ] Consegue atualizar status dos pedidos

---

## 🛠️ Solução de Problemas

### Erro: "Porta já em uso"
Outro processo está usando a porta 3001. Solução:
1. Mude a porta em `server.js`
2. Ou mate o processo: `netstat -ano | findstr :3001` e depois `taskkill /PID [número] /F`

### Erro: "Cannot find module"
Execute: `npm install`

### Pedidos não aparecem no painel
1. Verifique se o servidor está rodando
2. Abra o console do navegador (F12) para ver erros
3. Certifique-se que a URL da API está correta (`http://localhost:3001`)

---

## 🎯 Próximos Passos (Opcional)

- [ ] Adicionar autenticação no painel admin
- [ ] Integrar com WhatsApp Business API
- [ ] Adicionar notificações em tempo real
- [ ] Deploy em servidor (Heroku, Railway, Vercel)
- [ ] Usar banco de dados real (MongoDB, PostgreSQL)
- [ ] Adicionar sistema de pagamento online

---

## 📞 Suporte

Se tiver dúvidas, verifique:
1. Console do navegador (F12)
2. Terminal onde o servidor está rodando
3. Arquivo `pedidos.json` para ver se os dados estão sendo salvos
