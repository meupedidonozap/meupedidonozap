## Problema

A função `sync-prices` (botão "Atualizar Preços" na DiColore) hoje só faz UPDATE em produtos que já existem no banco. Ela lê os 421 códigos da planilha, mas se um código não existe em `products`, é ignorado — por isso ficam 324 no banco enquanto a planilha tem 421.

## Objetivo

Fazer o "Atualizar Preços" também **cadastrar os produtos novos** encontrados na planilha (upsert por `code` dentro da loja), mantendo a lógica atual de atualização de preço e categoria.

## Mudanças

**Arquivo único:** `supabase/functions/sync-prices/index.ts`

1. Detectar colunas extras da planilha além de `procod` e `protabpre`:
   - `pronom` (ou equivalente já usado no import atual) → nome do produto
   - `des grp` → categoria (já detectado)
   - `procodbar` → código de barras/EAN, se existir (opcional, para descrição)
2. Após o loop de updates, identificar códigos da planilha que **não** estão em `products` para essa `store_id`.
3. Para cada código novo:
   - Resolver/criar categoria (reusa `catMap` já montado).
   - Gerar próximo `code` interno não é necessário — usar o `procod` da planilha como `code`, igual ao import atual.
   - Inserir em `products` com: `store_id`, `code`, `name` (fallback: `"Produto {code}"` se não houver coluna de nome), `base_price`, `category_id`, `is_active=true`, `has_variants=false`, `description=''`.
4. Retornar no JSON de resposta novos campos: `created_products` (contagem) e `products_created` (lista com code + name) para o toast do admin exibir.

## Detalhes técnicos

- Manter parser CSV RFC 4180 existente.
- Buscar índice do nome com tolerância: `pronom`, `descricao`, `des_pro`, `despro` (o que existir).
- Se nenhum campo de nome existir na planilha, ainda assim criar com nome = `code` (melhor cadastrar do que ignorar; admin edita depois).
- Não mexer em `variants`, `images`, nem em `product_assembly` — produtos entram simples.
- Nenhuma alteração de schema, RLS ou frontend. O toast atual em `StoreAdminPage` já mostra os campos do retorno; ele passa a mostrar também "X produtos criados" (pequeno ajuste de string opcional, mas o backend já devolve o número).

## Fora de escopo

- Remover produtos que estão no banco mas não na planilha (não solicitado).
- Sincronizar imagens ou variantes.
