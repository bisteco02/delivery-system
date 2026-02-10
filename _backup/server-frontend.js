const express = require('express');
const path = require('path');
const app = express();

app.use(express.static(path.join(__dirname, '.')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin/painel.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'painel.html'));
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor frontend rodando em http://localhost:${PORT}`);
});
