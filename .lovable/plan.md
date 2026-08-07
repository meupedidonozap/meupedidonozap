# Integração de Estoque (exclusiva DiColore)

Nova rotina de atualização de ESTOQUE nos mesmos moldes da atualização de preços, lendo uma planilha do Google Sheets com as colunas CODIGO / PRODUTO / ESTOQUE.

## O que será feito

1. **Campo de estoque no produto**
   - Nova coluna `stock` na tabela de produtos (padrão 0), já usada hoje apenas em variações.
   - Coluna "Estoque" na tabela de Produtos do painel (entre Categoria e Preço), como no destaque da imagem.
   - Campo de estoque editável no formulário de produto.

2. **Botão "Atualizar Estoque"**
   - Novo botão ao lado de "Atualizar Preços", visível somente para a loja DiColore.
   - Ao clicar, chama uma nova função de servidor `sync-stock` que lê a planilha:
     https://docs.google.com/spreadsheets/d/1iYMv2HWlSE4tNHXswnijRm1AZX6sd2wEf3lfEM4lWoU
   - Casamento por CODIGO (mesma regra do sync de preços). A coluna PRODUTO é apenas informativa/conferência.
   - Códigos da planilha que não existem no banco são ignorados e listados no relatório.
   - Produtos do banco ausentes na planilha ficam com estoque 0.
   - Toast de retorno igual ao de preços: quantos produtos atualizados, quantos códigos na planilha, quantos não encontrados.

3. **Estoque zerado bloqueia a compra**
   - Na vitrine, produto com estoque 0 aparece marcado como **ESGOTADO**, sem botão de comprar.
   - No carrinho/checkout e nos pedidos criados pelo admin, item sem estoque é bloqueado (mesma lógica já usada para preço indisponível na tabela do cliente).
   - Sem baixa automática por pedido: o estoque só muda pela planilha ou por edição manual no painel.

## Detalhes técnicos

- Migration: `ALTER TABLE public.products ADD COLUMN stock integer NOT NULL DEFAULT 0`.
- Edge Function `supabase/functions/sync-stock/index.ts`, reaproveitando o padrão do `sync-prices`: leitura via conector Google Sheets (gateway com `LOVABLE_API_KEY` + `GOOGLE_SHEETS_API_KEY`), normalização de cabeçalhos (`codigo/procod/cod/code`, `estoque/saldo/qtd/quantidade`), atualização em lote por `store_id`.
- Tipos: `stock` em `Product` (`src/types/index.ts`) e mapeamento em `src/hooks/useProducts.ts`.
- Disponibilidade: helper `isProductAvailable` combinando preço da tabela do cliente + estoque, aplicado em `ProductStorePage`, `CartContext`, `CheckoutPage`, `NewOrderDialog` e `EditOrderDialog`.
- Botão de estoque condicionado ao slug da DiColore, como as demais rotinas exclusivas dessa loja.
