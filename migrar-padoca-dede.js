// Script para migrar Padoca do Dedé para o sistema multi-tenant
const { dbRun, dbGet } = require('./database');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

async function migrarPadocaDede() {
  try {
    console.log('🚀 Iniciando migração da Padoca do Dedé...\n');

    // 1. Criar/Atualizar tenant Padoca do Dedé
    console.log('📝 Criando estabelecimento...');
    const tenantExistente = await dbGet('SELECT id FROM tenants WHERE slug = ?', ['padoca-do-dede']);
    
    let tenantId;
    if (tenantExistente) {
      tenantId = tenantExistente.id;
      console.log('   ✅ Tenant já existe (ID:', tenantId, ')');
    } else {
      const resultado = await dbRun(`
        INSERT INTO tenants (slug, nome, telefone, whatsapp, ativo, plano, endereco)
        VALUES (?, ?, ?, ?, 1, 'premium', ?)
      `, [
        'padoca-do-dede',
        'Padoca do Dedé',
        '5563999999999',
        '5563999999999',
        'Endereço da Padoca do Dedé'
      ]);
      tenantId = resultado.id;
      console.log('   ✅ Tenant criado (ID:', tenantId, ')');
    }

    // 2. Criar usuário admin
    console.log('\n👤 Criando usuário admin...');
    const senhaHash = crypto.createHash('md5').update('admin123').digest('hex');
    const usuarioExistente = await dbGet('SELECT id FROM usuarios WHERE email = ? AND tenant_id = ?', 
      ['admin@padocadodede.com', tenantId]);
    
    if (!usuarioExistente) {
      await dbRun(`
        INSERT INTO usuarios (tenant_id, nome, email, senha, tipo)
        VALUES (?, ?, ?, ?, 'admin')
      `, [tenantId, 'Administrador', 'admin@padocadodede.com', senhaHash]);
      console.log('   ✅ Usuário criado');
      console.log('   📧 Email: admin@padocadodede.com');
      console.log('   🔑 Senha: admin123');
    } else {
      console.log('   ✅ Usuário já existe');
    }

    // 3. Criar categorias
    console.log('\n📂 Criando categorias...');
    const categorias = [
      { nome: 'Burguers', ordem: 1 },
      { nome: 'Pizzas', ordem: 2 },
      { nome: 'Monte sua Pizza', ordem: 3 },
      { nome: 'Porções', ordem: 4 },
      { nome: 'Sobremesas', ordem: 5 },
      { nome: 'Bebidas', ordem: 6 }
    ];

    const categoriasMap = {};
    for (const cat of categorias) {
      const existente = await dbGet(
        'SELECT id FROM categorias WHERE nome = ? AND tenant_id = ?',
        [cat.nome, tenantId]
      );
      
      if (existente) {
        categoriasMap[cat.nome] = existente.id;
        console.log(`   ✅ ${cat.nome} (ID: ${existente.id})`);
      } else {
        const resultado = await dbRun(`
          INSERT INTO categorias (tenant_id, nome, ordem, ativo)
          VALUES (?, ?, ?, 1)
        `, [tenantId, cat.nome, cat.ordem]);
        categoriasMap[cat.nome] = resultado.id;
        console.log(`   ✅ ${cat.nome} criado (ID: ${resultado.id})`);
      }
    }

    // 4. Migrar produtos do cardapio.json
    console.log('\n📦 Migrando produtos do cardapio.json...');
    try {
      const cardapioPath = path.join(__dirname, 'cardapio.json');
      const cardapioData = await fs.readFile(cardapioPath, 'utf8');
        const produtos = JSON.parse(cardapioData);
      
      let produtosTotal = 0;
      
        // Mapear nomes de categorias do JSON para os nomes no banco
        const categoriaMap = {
          'burguers': 'Burguers',
          'pizzas': 'Pizzas',
          'monte-pizza': 'Monte sua Pizza',
          'porcoes': 'Porções',
          'sobremesas': 'Sobremesas',
          'bebidas': 'Bebidas'
        };
      
        for (const item of produtos) {
          const categoriaSlug = item.category;
          const categoriaNome = categoriaMap[categoriaSlug];
          const categoriaId = categoriasMap[categoriaNome];
        
        if (!categoriaId) {
            console.log(`   ⚠️ Categoria não encontrada: ${categoriaSlug}`);
          continue;
        }
        
          const existente = await dbGet(
            'SELECT id FROM produtos WHERE nome = ? AND tenant_id = ?',
            [item.name, tenantId]
          );
        
          if (!existente && item.ativo !== false) {
            await dbRun(`
              INSERT INTO produtos (
                tenant_id, categoria_id, nome, descricao, preco, 
                preco_promocional, imagem, disponivel, destaque, ordem
              ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            `, [
              tenantId,
              categoriaId,
              item.name,
              item.description || '',
              item.price,
              item.promotionalPrice || null,
              item.image || null,
              item.featured ? 1 : 0,
              0
            ]);
            produtosTotal++;
        }
      }
      
      console.log(`   ✅ ${produtosTotal} produtos migrados`);
    } catch (error) {
      console.log('   ⚠️ Erro ao migrar produtos:', error.message);
      console.log('   ℹ️ Você pode adicionar produtos manualmente depois');
    }

    console.log('\n✨ MIGRAÇÃO CONCLUÍDA COM SUCESSO! ✨\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📌 INFORMAÇÕES DE ACESSO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🌐 URL do Site:');
    console.log('   http://localhost:3001/index.html?tenant=padoca-do-dede');
    console.log('');
    console.log('🛒 Checkout:');
    console.log('   http://localhost:3001/checkout.html?tenant=padoca-do-dede');
    console.log('');
    console.log('🔐 Painel Admin:');
    console.log('   http://localhost:3001/painel-admin.html?tenant=padoca-do-dede');
    console.log('   Email: admin@padocadodede.com');
    console.log('   Senha: admin123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    process.exit(1);
  }
}

// Executar migração
migrarPadocaDede();
