## Objetivo

Ao rodar a sincronização de preços da Dicolore, o menu de **Categorias** no painel admin deve refletir exatamente as categorias que existem nos produtos importados da planilha:

- Categorias que ficarem **sem produtos** devem ser **eliminadas**.
- Categorias novas vindas da planilha continuam sendo **criadas** (já ocorre hoje).
- Toda categoria **criada automaticamente** pela sincronização deve nascer com **comissão = 1.00%** (hoje nasce 0%).
- Categorias duplicadas (mesmo nome) devem ser **consolidadas** em uma única, movendo os produtos para a categoria mantida antes da limpeza — isso resolve o caso atual da Dicolore onde há entradas duplicadas no menu (ex.: "LAVATORIO (LITRO)", "LINHA DICCO") aparecendo com 0 produtos.

## Mudanças

Arquivo único: `supabase/functions/sync-prices/index.ts`.

### 1. Comissão padrão nas categorias criadas

Nos dois pontos onde o edge function faz `insert` em `categories` (durante o update de produtos existentes e durante a inserção de produtos novos), passar `commission_percent: 1.00` no payload, no lugar do default 0.

### 2. Consolidação de categorias duplicadas por nome

Antes da fase de limpeza, para cada nome de categoria que apareça mais de uma vez no store:

1. Escolher uma categoria "canônica" (a mais antiga por `created_at`, ou a que já tem mais produtos).
2. Atualizar `products.category_id` de todos os produtos que apontam para as duplicadas, redirecionando para a canônica.
3. Deletar as duplicadas vazias.

### 3. Eliminação de categorias sem produtos

Após aplicar todas as atualizações e inserções de produtos:

1. Recarregar `products` do store (apenas `category_id`).
2. Buscar todas as `categories` do store.
3. Deletar as categorias cujo `id` não aparece em nenhum `product.category_id` do store.

### 4. Resposta do endpoint

Incluir no JSON de retorno os novos contadores para feedback ao admin:

- `categories_merged` (duplicadas consolidadas)
- `categories_deleted` (removidas por estarem vazias)

### 5. Fora de escopo

- Sem alterações em UI, hooks, RLS ou outras edge functions.
- A regra "eliminar categorias vazias" roda **apenas** dentro do `sync-prices` (fluxo Dicolore), não como job global — categorias vazias criadas manualmente em outras lojas continuam intactas.
- Comissão de 1.00% é aplicada só quando a categoria é **criada** pela sincronização; categorias já existentes preservam a comissão que o admin configurou.

## Validação

- Rodar "Sincronizar preços" no admin da Dicolore.
- Conferir na aba **Categorias** que as entradas duplicadas com 0 produtos sumiram e as demais mostram a contagem correta.
- Conferir que categorias novas trazidas da planilha aparecem com "Comissão: 1.00%".
- Conferir que categorias existentes mantiveram sua comissão anterior.
