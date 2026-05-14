import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent
cardapio_path = root / '_backup' / 'cardapio.json'
painel_path = root / 'painel-admin.js'

cardapio_data = [
    {"name": "CORINGA", "category": "burguers", "price": 40, "image": "./assets/coringa.avif", "description": "Pão de abóbora, 2x burger 150g, 2x mussarela, 2x bacon, 2x cebola caramelizada, molho especial, maionese.", "ativo": True},
    {"name": "DARTH VADER", "category": "burguers", "price": 40, "image": "./assets/darthvader.jpg", "description": "Pão de abóbora, 2x burger 150g, 2x cheddar, 2x bacon, 2x cebola caramelizada, molho barbecue, maionese.", "ativo": True},
    {"name": "GARGAMEL", "category": "burguers", "price": 30, "image": "./assets/Gargamel.jpg", "description": "Pão americano, maionese, burger 150g, mussarela, bacon, cebola caramelizada, maionese, molho especial.", "ativo": True},
    {"name": "LEX LUTHOR", "category": "burguers", "price": 30, "image": "./assets/lexluthor.avif", "description": "Pão americano, barbecue, burger 150g, cheddar, bacon, cebola caramelizada, maionese.", "ativo": True},
    {"name": "MUN RA", "category": "burguers", "price": 32, "image": "./assets/mun-ra.png", "description": "Pão americano, burger, mussarela, bacon, cebola caramelizada, cebola roxa, alface, tomate, maionese e molho especial.", "ativo": True},
    {"name": "RAINHA DE COPAS", "category": "burguers", "price": 26, "image": "./assets/rainha-de-copas.avif", "description": "Pão americano, molho especial, maionese, burger 150g, mussarela, tomate, alface americana, cebola roxa e maionese.", "ativo": True},
    {"name": "MANJIM BOO", "category": "burguers", "price": 32, "image": "./assets/majimboo.avif", "description": "Pão de abóbora, molho especial, ketchup, burger 150g, frango com ervas 100g, mussarela, tomate roxa, maionese.", "ativo": True},
    {"name": "MADARA", "category": "burguers", "price": 32, "image": "./assets/madara.png", "description": "Pão australiano, carne de porco 150g, bacon, mussarela na chapa, cheddar, cebola crispy e molho barbecue.", "ativo": True},
    {"name": "THANOS", "category": "burguers", "price": 42, "image": "./assets/thanos.png", "description": "Pão australiano, 2x burger de porco, 2x bacon, 2x mussarela na chapa, 2x cheddar, cebola crispy e molho barbecue.", "ativo": True},
    {"name": "DE LA CRUZ", "category": "burguers", "price": 40, "image": "./assets/delacruz.png", "description": "Pão australiano, 2x carne 150g, 2x mussarela, 2x bacon, 2x cebola caramelizada, molho especial, maionese, tomate, alface americana.", "ativo": True},
    {"name": "ROBOTNIK", "category": "burguers", "price": 40, "image": "./assets/robotnik.png", "description": "Pão americano, burger 150g, requeijão, frango com ervas, cebola roxa, tomate e ketchup.", "ativo": True},
    {"name": "EXTERMINATOR - T800", "category": "burguers", "price": 42, "image": "./assets/exterminador.jpg", "description": "Pão australiano, 3x burger 150g, 3x cheddar e cebola roxa.", "ativo": True},
    {"name": "ROGER KLOTZ", "category": "burguers", "price": 26, "image": "./assets/roger-klotz.png", "description": "Pão americano, burger, cheddar, alface, tomate, ketchup e maionese.", "ativo": True},
    {"name": "JUGGERNAULT", "category": "burguers", "price": 40, "image": "./assets/juggernault.png", "description": "Pão americano, 2x burger 150g, 2x cheddar, cebola crispy, tomate, alface, ketchup e maionese.", "ativo": True},
    {"name": "MIRANDA PRIESTLY (Margherita) - 8 pedaços", "category": "pizzas", "price": 60, "image": "./assets/Margherita.png", "description": "Massa de longa fermentação, molho de tomate, mussarela, parmesão e tomate.", "ativo": True, "monteEnabled": True},
    {"name": "NAZARÉ TEDESCO (Calabresa) - 8 pedaços", "category": "pizzas", "price": 65, "image": "./assets/Calabresa.png", "description": "Massa de longa fermentação, molho de tomate, calabresa, mussarela e parmesão.", "ativo": True, "monteEnabled": True},
    {"name": "DANAERYS TARGERIAN (Frango com requeijão) - 8 pedaços", "category": "pizzas", "price": 65, "image": "./assets/Frango e Catupiry.jpg", "description": "Massa de longa fermentação, molho de tomate, mussarela, frango e requeijão.", "ativo": True, "monteEnabled": True},
    {"name": "CRUELLA (3 queijos) - 8 pedaços", "category": "pizzas", "price": 65, "image": "./assets/3 queijos.png", "description": "Massa de longa fermentação, molho de tomate, mussarela, requeijão e parmesão.", "ativo": True, "monteEnabled": True},
    {"name": "AGATHA TRUNCHBULL (Autoral) - 8 pedaços", "category": "pizzas", "price": 85, "image": "./assets/agatha.png", "description": "Massa de longa fermentação, molho de tomate, mussarela, parmesão, calabresa, carne de sol e requeijão cremoso.", "ativo": True, "monteEnabled": True},
    {"name": "PAOLLA BRACHO (Portuguesa) - 8 pedaços", "category": "pizzas", "price": 75, "image": "./assets/portuguesa.png", "description": "Massa de longa fermentação, molho de tomate, mussarela, parmesão, bacon, requeijão, cebola roxa, tomate e orégano.", "ativo": True, "monteEnabled": True},
    {"name": "ANABELE (Autoral) - 8 pedaços", "category": "pizzas", "price": 75, "image": "./assets/anabele.jpg", "description": "Massa de longa fermentação, molho de tomate, frango, requeijão, bacon, alho frito e mussarela.", "ativo": True, "monteEnabled": True},
    {"name": "ANA KARENINA (Autoral) - 8 pedaços", "category": "pizzas", "price": 90, "image": "./assets/ana karienina.avif", "description": "Massa de longa fermentação, molho de tomate, mussarela, bacon, alho frito e mussarela.", "ativo": True, "monteEnabled": True},
    {"name": "Pizza 2 sabores", "category": "monte-pizza", "price": 0, "image": "./assets/monte sua pizza.png", "description": "Escolha 2 sabores no modal", "ativo": True},
    {"name": "Batata Tradicional", "category": "porcoes", "price": 20, "image": "./assets/batata tradicional.png", "description": "450g (Temperada com sal)", "ativo": True},
    {"name": "Batata Red Smoked", "category": "porcoes", "price": 20, "image": "./assets/batata red smoked.png", "description": "450g (com tempero especial)", "ativo": True},
    {"name": "Onion Rings", "category": "porcoes", "price": 22, "image": "./assets/onion rings.png", "description": "300g", "ativo": True},
    {"name": "Batata Rústica", "category": "porcoes", "price": 22, "image": "./assets/batata rustica.png", "description": "350g", "ativo": True},
    {"name": "Bolinho de Carne de Sol com Requeijão", "category": "porcoes", "price": 22, "image": "./assets/bolinho de carne de sol.png", "description": "6 bolinho de 45g", "ativo": True},
    {"name": "Batata Garlic & Onion", "category": "porcoes", "price": 20, "image": "./assets/batata garlic e onion.png", "description": "450g (com tempero especial)", "ativo": True},
    {"name": "Bolo de pote - Ninho trufado", "category": "sobremesas", "price": 18, "image": "./assets/bolo de pote ninho trufaod.png", "description": "Bolo delicioso de leite ninho com chocolate meio amargo.", "ativo": True},
    {"name": "Bolo de pote - Abacaxi aos 4 leites", "category": "sobremesas", "price": 16, "image": "./assets/bolo de pote abacaxi.png", "description": "Pão de ló, abacaxi, leite condensado, creme de leite, leite em pó e leite de coco.", "ativo": True},
    {"name": "Coca-Cola Zero Lata 350ml", "category": "bebidas", "price": 7.50, "image": "./assets/Coca Zero Lata.png", "description": "Bebida gelada", "ativo": True},
    {"name": "Coca-Cola Original 2L", "category": "bebidas", "price": 16, "image": "./assets/Coca 2L.jpg", "description": "Bebida gelada", "ativo": True},
    {"name": "Coca-Cola Original 350ml", "category": "bebidas", "price": 7, "image": "./assets/Coca Lata.jpg", "description": "Bebida gelada", "ativo": True},
    {"name": "Coca-Cola Zero 2L", "category": "bebidas", "price": 17, "image": "./assets/Coca Zero 2L.png", "description": "Bebida gelada", "ativo": True},
    {"name": "Refrigerante Guaraná Antártica 350ml", "category": "bebidas", "price": 7, "image": "./assets/Guarana Lata.jpg", "description": "Bebida gelada", "ativo": True}
]
"

menu_js = """
let menu = [
  {name: "CORINGA", category: "burguers", price: 40.00, image: "./assets/coringa.avif", description: "Pão de abóbora, 2x burger 150g, 2x mussarela, 2x bacon, 2x cebola caramelizada, molho especial, maionese.", ativo: true},
  {name: "DARTH VADER", category: "burguers", price: 40.00, image: "./assets/darthvader.jpg", description: "Pão de abóbora, 2x burger 150g, 2x cheddar, 2x bacon, 2x cebola caramelizada, molho barbecue, maionese.", ativo: true},
  {name: "GARGAMEL", category: "burguers", price: 30.00, image: "./assets/Gargamel.jpg", description: "Pão americano, maionese, burger 150g, mussarela, bacon, cebola caramelizada, maionese, molho especial.", ativo: true},
  {name: "LEX LUTHOR", category: "burguers", price: 30.00, image: "./assets/lexluthor.avif", description: "Pão americano, barbecue, burger 150g, cheddar, bacon, cebola caramelizada, maionese.", ativo: true},
  {name: "MUN RA", category: "burguers", price: 32.00, image: "./assets/mun-ra.png", description: "Pão americano, burger, mussarela, bacon, cebola caramelizada, cebola roxa, alface, tomate, maionese e molho especial.", ativo: true},
  {name: "RAINHA DE COPAS", category: "burguers", price: 26.00, image: "./assets/rainha-de-copas.avif", description: "Pão americano, molho especial, maionese, burger 150g, mussarela, tomate, alface americana, cebola roxa e maionese.", ativo: true},
  {name: "MANJIM BOO", category: "burguers", price: 32.00, image: "./assets/majimboo.avif", description: "Pão de abóbora, molho especial, ketchup, burger 150g, frango com ervas 100g, mussarela, tomate roxa, maionese.", ativo: true},
  {name: "MADARA", category: "burguers", price: 32.00, image: "./assets/madara.png", description: "Pão australiano, carne de porco 150g, bacon, mussarela na chapa, cheddar, cebola crispy e molho barbecue.", ativo: true},
  {name: "THANOS", category: "burguers", price: 42.00, image: "./assets/thanos.png", description: "Pão australiano, 2x burger de porco, 2x bacon, 2x mussarela na chapa, 2x cheddar, cebola crispy e molho barbecue.", ativo: true},
  {name: "DE LA CRUZ", category: "burguers", price: 40.00, image: "./assets/delacruz.png", description: "Pão australiano, 2x carne 150g, 2x mussarela, 2x bacon, 2x cebola caramelizada, molho especial, maionese, tomate, alface americana.", ativo: true},
  {name: "ROBOTNIK", category: "burguers", price: 40.00, image: "./assets/robotnik.png", description: "Pão americano, burger 150g, requeijão, frango com ervas, cebola roxa, tomate e ketchup.", ativo: true},
  {name: "EXTERMINATOR - T800", category: "burguers", price: 42.00, image: "./assets/exterminador.jpg", description: "Pão australiano, 3x burger 150g, 3x cheddar e cebola roxa.", ativo: true},
  {name: "ROGER KLOTZ", category: "burguers", price: 26.00, image: "./assets/roger-klotz.png", description: "Pão americano, burger, cheddar, alface, tomate, ketchup e maionese.", ativo: true},
  {name: "JUGGERNAULT", category: "burguers", price: 40.00, image: "./assets/juggernault.png", description: "Pão americano, 2x burger 150g, 2x cheddar, cebola crispy, tomate, alface, ketchup e maionese.", ativo: true},
  {name: "MIRANDA PRIESTLY (Margherita) - 8 pedaços", category: "pizzas", price: 60.00, image: "./assets/Margherita.png", description: "Massa de longa fermentação, molho de tomate, mussarela, parmesão e tomate.", ativo: true, monteEnabled: true},
  {name: "NAZARÉ TEDESCO (Calabresa) - 8 pedaços", category: "pizzas", price: 65.00, image: "./assets/Calabresa.png", description: "Massa de longa fermentação, molho de tomate, calabresa, mussarela e parmesão.", ativo: true, monteEnabled: true},
  {name: "DANAERYS TARGERIAN (Frango com requeijão) - 8 pedaços", category: "pizzas", price: 65.00, image: "./assets/Frango e Catupiry.jpg", description: "Massa de longa fermentação, molho de tomate, mussarela, frango e requeijão.", ativo: true, monteEnabled: true},
  {name: "CRUELLA (3 queijos) - 8 pedaços", category: "pizzas", price: 65.00, image: "./assets/3 queijos.png", description: "Massa de longa fermentação, molho de tomate, mussarela, requeijão e parmesão.", ativo: true, monteEnabled: true},
  {name: "AGATHA TRUNCHBULL (Autoral) - 8 pedaços", category: "pizzas", price: 85.00, image: "./assets/agatha.png", description: "Massa de longa fermentação, molho de tomate, mussarela, parmesão, calabresa, carne de sol e requeijão cremoso.", ativo: true, monteEnabled: true},
  {name: "PAOLLA BRACHO (Portuguesa) - 8 pedaços", category: "pizzas", price: 75.00, image: "./assets/portuguesa.png", description: "Massa de longa fermentação, molho de tomate, mussarela, parmesão, bacon, requeijão, cebola roxa, tomate e orégano.", ativo: true, monteEnabled: true},
  {name: "ANABELE (Autoral) - 8 pedaços", category: "pizzas", price: 75.00, image: "./assets/anabele.jpg", description: "Massa de longa fermentação, molho de tomate, frango, requeijão, bacon, alho frito e mussarela.", ativo: true, monteEnabled: true},
  {name: "ANA KARENINA (Autoral) - 8 pedaços", category: "pizzas", price: 90.00, image: "./assets/ana karienina.avif", description: "Massa de longa fermentação, molho de tomate, mussarela, bacon, alho frito e mussarela.", ativo: true, monteEnabled: true},
  {name: "Pizza 2 sabores", category: "monte-pizza", price: 0.00, image: "./assets/monte sua pizza.png", description: "Escolha 2 sabores no modal", ativo: true},
  {name: "Batata Tradicional", category: "porcoes", price: 20.00, image: "./assets/batata tradicional.png", description: "450g (Temperada com sal)", ativo: true},
  {name: "Batata Red Smoked", category: "porcoes", price: 20.00, image: "./assets/batata red smoked.png", description: "450g (com tempero especial)", ativo: true},
  {name: "Onion Rings", category: "porcoes", price: 22.00, image: "./assets/onion rings.png", description: "300g", ativo: true},
  {name: "Batata Rústica", category: "porcoes", price: 22.00, image: "./assets/batata rustica.png", description: "350g", ativo: true},
  {name: "Bolinho de Carne de Sol com Requeijão", category: "porcoes", price: 22.00, image: "./assets/bolinho de carne de sol.png", description: "6 bolinho de 45g", ativo: true},
  {name: "Batata Garlic & Onion", category: "porcoes", price: 20.00, image: "./assets/batata garlic e onion.png", description: "450g (com tempero especial)", ativo: true},
  {name: "Bolo de pote - Ninho trufado", category: "sobremesas", price: 18.00, image: "./assets/bolo de pote ninho trufaod.png", description: "Bolo delicioso de leite ninho com chocolate meio amargo.", ativo: true},
  {name: "Bolo de pote - Abacaxi aos 4 leites", category: "sobremesas", price: 16.00, image: "./assets/bolo de pote abacaxi.png", description: "Pão de ló, abacaxi, leite condensado, creme de leite, leite em pó e leite de coco.", ativo: true},
  {name: "Coca-Cola Zero Lata 350ml", category: "bebidas", price: 7.50, image: "./assets/Coca Zero Lata.png", description: "Bebida gelada", ativo: true},
  {name: "Coca-Cola Original 2L", category: "bebidas", price: 16.00, image: "./assets/Coca 2L.jpg", description: "Bebida gelada", ativo: true},
  {name: "Coca-Cola Original 350ml", category: "bebidas", price: 7.00, image: "./assets/Coca Lata.jpg", description: "Bebida gelada", ativo: true},
  {name: "Coca-Cola Zero 2L", category: "bebidas", price: 17.00, image: "./assets/Coca Zero 2L.png", description: "Bebida gelada", ativo: true},
  {name: "Refrigerante Guaraná Antártica 350ml", category: "bebidas", price: 7.00, image: "./assets/Guarana Lata.jpg", description: "Bebida gelada", ativo: true}
];
"""

if not cardapio_path.exists():
    raise FileNotFoundError(cardapio_path)
if not painel_path.exists():
    raise FileNotFoundError(painel_path)

cardapio_path.write_text(json.dumps(cardapio_data, indent=2, ensure_ascii=False) + "\n", encoding='utf-8')

painel_text = painel_path.read_text(encoding='utf-8')
new_painel = re.sub(r'let menu = \[.*?\n\];\n', menu_js + "\n", painel_text, flags=re.S)
if new_painel == painel_text:
    raise RuntimeError('Could not find and replace menu block in painel-admin.js')

painel_path.write_text(new_painel, encoding='utf-8')
print('updated', cardapio_path, painel_path)
