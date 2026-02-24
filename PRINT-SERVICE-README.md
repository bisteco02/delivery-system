# 🖨️ Serviço de Impressão Automática de Pedidos

Este serviço monitora novos pedidos no servidor e imprime automaticamente na impressora padrão do cliente.

## ⚙️ Instalação

### Pré-requisitos
- Node.js 14+ instalado
- Impressora configurada como padrão no seu sistema

### Passos

1. **Clonar ou baixar o projeto**

2. **Instalar dependências globais** (se necessário)
```bash
npm install
```

3. **Configurar o servidor** 
Edite o `print-service.js` ou use variáveis de ambiente:

```bash
# Windows
set API_URL=https://seu-servidor.com
set PRINTER_NAME=Sua Impressora

# Linux/Mac
export API_URL=https://seu-servidor.com
export PRINTER_NAME="Sua Impressora"
```

4. **Iniciar o serviço**

```bash
node print-service.js
```

## 🔧 Configuração

### Windows

1. Abra `Dispositivos e Impressoras`
2. Clique com direito na impressora desejada
3. Selecione "Definir como impressora padrão"
4. Execute: `node print-service.js`

### Linux

```bash
# Listar impressoras
lpstat -p -d

# Definir padrão
lpadmin -d <nome-impressora>

# Executar
node print-service.js
```

### macOS

```bash
# Listar impressoras
lpstat -p -d

# Definir padrão
lpadmin -d <nome-impressora>

# Executar
node print-service.js
```

## 🚀 Usar como Serviço em Background

### Windows (usando PM2)
```bash
npm install -g pm2
pm2 start print-service.js --name "print-service"
pm2 startup
pm2 save
```

### Linux/Mac (usando PM2)
```bash
pm2 start print-service.js --name "print-service"
pm2 startup
pm2 save
```

### Linux (usando systemd)
Criar arquivo `/etc/systemd/system/print-service.service`:
```ini
[Unit]
Description=Automatic Order Printing Service
After=network.target

[Service]
Type=simple
User=seu_usuario
WorkingDirectory=/caminho/do/projeto
ExecStart=/usr/bin/node /caminho/do/projeto/print-service.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Ativar:
```bash
sudo systemctl daemon-reload
sudo systemctl enable print-service
sudo systemctl start print-service
sudo systemctl status print-service
```

## 📋 Como Funciona

1. O serviço conecta ao servidor a cada 5 segundos
2. Busca por novos pedidos com status "pendente"
3. Se encontrar um pedido novo, imprime automaticamente
4. Rastreia o último pedido impresso (arquivo `.last-printed-id.txt`)
5. Nunca imprime o mesmo pedido duas vezes

## 🔍 Logs

O serviço exibe logs no console:
- ✅ Pedido impresso com sucesso
- ❌ Erros de conexão
- 📄 Novos pedidos encontrados
- 🖨️ Status de impressão

## 🛠️ Troubleshooting

### "Erro ao buscar pedidos"
- Verifique se o servidor está online
- Confirme a URL em `API_URL`
- Teste com: `curl https://seu-servidor.com/api/pedidos`

### "Impressora não encontrada"
- Verifique o nome da impressora no seu sistema
- Use: `lpstat -p -d` (Linux/Mac) ou Dispositivos e Impressoras (Windows)

### Não está imprimindo nada
- Verifique se a impressora está configurada como padrão
- Veja os logs no console
- Crie um pedido de teste no painel admin

## 📝 Variáveis de Ambiente

```
API_URL       - URL do servidor (padrão: http://localhost:3001)
PRINTER_NAME  - Nome da impressora (padrão: Padrão)
```

## 📞 Suporte

Para problemas ou dúvidas, verifique:
1. Se o serviço está rodando
2. Se a impressora está conectada
3. Os logs do console para erros específicos
