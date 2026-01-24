const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'padoca_platform.db');

// Criar ou abrir banco de dados
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err);
  } else {
    console.log('✅ Banco de dados conectado');
    inicializarTabelas();
  }
});

// Criar tabelas
function inicializarTabelas() {
  db.serialize(() => {
    // Tabela de Tenants (Estabelecimentos)
    db.run(`
      CREATE TABLE IF NOT EXISTS tenants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        nome TEXT NOT NULL,
        email TEXT,
        telefone TEXT,
        endereco TEXT,
        logo TEXT,
        whatsapp TEXT,
        horario_funcionamento TEXT,
        ativo INTEGER DEFAULT 1,
        plano TEXT DEFAULT 'basico',
        data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
        data_expiracao DATETIME,
        config_json TEXT
      )
    `);

    // Tabela de Usuários (Donos dos estabelecimentos)
    db.run(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        tipo TEXT DEFAULT 'admin',
        ativo INTEGER DEFAULT 1,
        data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      )
    `);

    // Tabela de Categorias
    db.run(`
      CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        nome TEXT NOT NULL,
        ordem INTEGER DEFAULT 0,
        ativo INTEGER DEFAULT 1,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      )
    `);

    // Tabela de Produtos
    db.run(`
      CREATE TABLE IF NOT EXISTS produtos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        categoria_id INTEGER,
        nome TEXT NOT NULL,
        descricao TEXT,
        preco REAL NOT NULL,
        preco_promocional REAL,
        imagem TEXT,
        disponivel INTEGER DEFAULT 1,
        destaque INTEGER DEFAULT 0,
        ordem INTEGER DEFAULT 0,
        data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL
      )
    `);

    // Tabela de Promoções
    db.run(`
      CREATE TABLE IF NOT EXISTS promocoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        tipo TEXT NOT NULL,
        titulo TEXT NOT NULL,
        descricao TEXT,
        condicao TEXT,
        desconto_porcentagem REAL,
        desconto_valor REAL,
        produto_gratis_id INTEGER,
        produtos_necessarios TEXT,
        data_inicio DATETIME,
        data_fim DATETIME,
        ativo INTEGER DEFAULT 1,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      )
    `);

    // Tabela de Pedidos
    db.run(`
      CREATE TABLE IF NOT EXISTS pedidos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        numero_pedido TEXT UNIQUE NOT NULL,
        cliente_nome TEXT NOT NULL,
        cliente_telefone TEXT NOT NULL,
        cliente_endereco TEXT,
        itens TEXT NOT NULL,
        total REAL NOT NULL,
        forma_pagamento TEXT,
        observacoes TEXT,
        status TEXT DEFAULT 'pendente',
        data_pedido DATETIME DEFAULT CURRENT_TIMESTAMP,
        data_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      )
    `);

    // Inserir tenant padrão (migração dos dados existentes)
    db.run(`
      INSERT OR IGNORE INTO tenants (id, slug, nome, ativo, plano)
      VALUES (1, 'demo', 'Padoca Demo', 1, 'premium')
    `);

    console.log('✅ Tabelas criadas/verificadas com sucesso');
  });
}

// Funções auxiliares
const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

module.exports = {
  db,
  dbGet,
  dbAll,
  dbRun
};
