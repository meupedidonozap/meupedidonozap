# Bling como fonte única do catálogo (Jewos e lojas com Bling)

## Orientação de preço
Mude o preço **só no Bling**. O MPZ copia o preço do Bling. Se o preço for mudado no MPZ, a próxima sincronização volta para o preço do Bling. Assim o pedido feito no catálogo sempre sai com o preço da Bling.

## O que vai mudar
1. **Estoque e Ativo/Inativo**: continua automático a cada 15 min (sem mudança).
2. **Preço**: passa a ser atualizado a cada 15 min, no produto simples, no produto pai e em cada cor.
3. **Nome e descrição**: atualizados quando você clica em "Importar produtos e estoque".
4. **Fotos**: no botão de importar, entram as fotos novas e saem do MPZ as fotos que foram removidas no Bling (só as que vieram do Bling; foto colocada à mão no MPZ fica).
5. Produto inativado à mão no MPZ continua não sendo reativado.

## Detalhes técnicos
- `bling-sync` `cronStock`: ler `preco` da listagem `/produtos` e atualizar `base_price`/`price_table_4` (produto) e `price`/`price_table_4` (variante por sku) quando diferente; preço 0 é ignorado.
- `productsBatch` (produto existente): atualizar também `name`, `description`, `base_price`, `price_table_4`.
- `imagesBatch`: receber a lista completa de links de cada produto; apagar `product_images` com caminho `${storeId}/bling/` que não estão mais na lista e reapontar `image_url` se a principal foi removida.
- Deploy de `bling-sync` e teste com um lote da Jewos.
