

# Excluir Produtos e Pedidos Cancelados da Rafa's Manutenção Residencial

## Dados encontrados

- **Loja**: Rafa's Manutenção Residencial (`c7bd7750-6840-47f2-947c-26059c4d6b74`)
- **279 produtos** a excluir
- **3 pedidos com status "cancelado"** a excluir

## Ações (via SQL direto)

1. Excluir `product_images` vinculadas aos produtos da loja
2. Excluir `product_variants` vinculadas aos produtos da loja
3. Excluir todos os `products` da loja
4. Excluir `orders` com status `cancelado` da loja

Todas as exclusões serão feitas em sequência para respeitar dependências.

