

# Deletar Todos os Produtos da Loja LF Store

## Dados

A loja LF Store (`id: 35dbd4ee-9f38-425c-9222-38794ff36f3d`) possui **1650 produtos** que precisam ser removidos.

## Plano de Execucao

Executar 3 comandos SQL via insert tool, nesta ordem (para respeitar dependencias):

1. **Deletar imagens dos produtos**
```sql
DELETE FROM product_images WHERE product_id IN (
  SELECT id FROM products WHERE store_id = '35dbd4ee-9f38-425c-9222-38794ff36f3d'
);
```

2. **Deletar variantes dos produtos**
```sql
DELETE FROM product_variants WHERE product_id IN (
  SELECT id FROM products WHERE store_id = '35dbd4ee-9f38-425c-9222-38794ff36f3d'
);
```

3. **Deletar os produtos**
```sql
DELETE FROM products WHERE store_id = '35dbd4ee-9f38-425c-9222-38794ff36f3d';
```

## Resultado

Todos os 1650 produtos, suas variantes e imagens serao removidos permanentemente da loja LF Store.

