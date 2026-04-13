

# Configurar loja GUABAITY como PIZZARIA com dados de teste

## Problema

A loja GUABAITY foi criada com tipo `COMIDA`, então ela renderiza a vitrine de delivery genérico (FoodStorePage) em vez da vitrine de pizzaria (PizzaStorePage). Alem disso, nao tem dados de teste cadastrados (tamanhos, sabores, lanches, porcoes, bebidas).

## Solucao

### 1. Alterar o tipo da loja para PIZZARIA

```sql
UPDATE stores SET type = 'PIZZARIA' WHERE slug = 'guabacity';
```

### 2. Inserir dados de teste

**Tamanhos de pizza** (tabela `pizza_sizes`):
- Pequena (1 sabor) - R$29,90
- Grande (2 sabores) - R$49,90
- Gigante (3 sabores) - R$64,90
- Exagerada (4 sabores) - R$79,90

**Sabores de pizza** (tabela `pizza_flavors`): ~12 sabores classicos (Calabresa, Mussarela, Frango c/ Catupiry, Portuguesa, Margherita, 4 Queijos, Pepperoni, Napolitana, Bacon, Lombo, Brasileira, Chocolate)

**Categorias** (tabela `categories`): Lanches, Porcoes, Bebidas

**Itens complementares** (tabela `food_items`):
- Lanches: X-Burger, X-Salada, X-Bacon (~3 itens)
- Porcoes: Batata Frita, Onion Rings, Nuggets (~3 itens)
- Bebidas: Coca-Cola, Guarana, Suco, Agua (~4 itens)

### Arquivos alterados
Nenhum arquivo de codigo precisa ser alterado. Apenas operacoes de dados no banco (UPDATE + INSERTs).

### Resultado
A loja GUABAITY vai abrir com a vitrine de pizzaria, mostrando o montador de pizza com tamanhos e sabores, alem das abas de lanches, porcoes e bebidas.

