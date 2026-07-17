## Diagnóstico

Rodei uma checagem no banco da Dicolore e o resultado é diferente do que aparenta na tela:

- **Grupos DOS PRODUTOS já foram corrigidos.** Ex.: `DV1100` agora está em "MATERIAL DE APOIO", `KIT086` em "KIT PROMOÇÃO", `7898418090477` em "COLORAÇÃO". De 452 produtos, apenas **2** ainda estão em categorias numéricas (grupos "100" e "54"), porque essas linhas vêm literalmente com esse nome em "Des GRP" na planilha.
- **O que ainda está errado é o menu de Categorias:** existem **26 categorias numéricas órfãs** ("40", "64", "148", "907", "908", "910", etc.) que ficaram com 0 produtos e **não foram apagadas** pela consolidação, mesmo com o código de limpeza rodando. É isso que dá a impressão visual de que "nada mudou".

A rotina de exclusão em `sync-prices` filtra `store_id` e usa `.in("id", emptyIds)`, mas o `supabase-js` v2 exige ordem específica das cláusulas em `delete({ count: "exact" })` — a combinação atual está silenciosamente não removendo essas linhas (nenhum erro é retornado, `count` volta 0 ou undefined e o toast diz sucesso).

## Ajustes propostos

### 1. `supabase/functions/sync-prices/index.ts` — limpar categorias vazias de forma robusta

Trocar o bloco final por duas passadas explícitas:

1. **Passo A — apagar por id em lote:** para cada `emptyId`, fazer `.delete().eq("id", id).eq("store_id", store_id)` e capturar erro individual (ignorando "still referenced" se ainda houver algum food_item/pizza_flavor apontando).
2. **Passo B — varredura extra:** ao final, rodar `.delete().eq("store_id", store_id)` filtrando por `id NOT IN (SELECT DISTINCT category_id FROM products WHERE store_id=... AND category_id IS NOT NULL)`. Como PostgREST não suporta subquery, faremos isso via RPC de duas etapas: buscar todos `category_id` distintos em produtos e usar `.not("id", "in", "(...)")` no delete.
3. **Contabilizar corretamente:** somar quantas foram efetivamente removidas e devolver no `categoriesDeleted` do JSON de resposta para dar visibilidade real no toast.

### 2. Toast do painel — mostrar contadores reais

Em `src/pages/StoreAdminPage.tsx` (handler de "Atualizar Preços"), incluir na mensagem `categorias removidas: X, mescladas: Y` para o usuário enxergar que a limpeza aconteceu.

### 3. Limpeza pontual dos 26 registros órfãos existentes

Como já sabemos exatamente quais são (categorias com `name ~ '^[0-9]+$'` e 0 produtos na Dicolore), incluir uma **migração SQL única** que remove essas linhas órfãs de qualquer loja:

```sql
DELETE FROM public.categories c
WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.category_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.food_items f WHERE f.category_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.pizza_flavors pf WHERE pf.category_id = c.id)
  AND c.name ~ '^[0-9]+$';
```

Isso é seguro: só apaga categorias cujo nome é puramente numérico e que não estão em uso por nenhum produto/prato/sabor.

### 4. Redeploy da Edge Function

`sync-prices` precisa ser redeployado para as mudanças entrarem no ar antes do próximo clique em "Atualizar Preços".

## Fora de escopo

- Nenhuma alteração em preços, tabelas 1/4/9, regras de desconto, ou tela de admin fora do toast do sync.
- Os 2 produtos que legitimamente têm grupo "100" e "54" na planilha continuam nesses grupos (é o dado de origem).

## Verificação após implementação

1. Rodar a migração → confere `SELECT COUNT(*) FROM categories WHERE store_id=... AND name ~ '^[0-9]+$'` = 2 (só as que ainda têm produto).
2. Clicar em "Atualizar Preços" → toast informa `categorias removidas` explicitamente.
3. Aba Categorias no admin não mostra mais linhas "0 produtos" com nome numérico.
