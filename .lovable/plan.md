## Correção: exibir ingredientes/borda/observação na listagem de pedidos

Hoje a coluna "Itens" das tabelas de pedidos mostra apenas `quantidade x nome` (e variante). Quando o produto é montado (COMIDA/PIZZARIA) com ingredientes selecionados, borda recheada, ingredientes removidos ou observação, essas informações não aparecem — quem prepara não sabe o que montar.

### O que será alterado

**`src/pages/StoreAdminPage.tsx`** — colunas "Itens" das duas tabelas de pedidos (Dashboard linha ~752 e Pedidos linha ~933):

Para cada item, abaixo da linha principal, renderizar (em texto pequeno, recuado):
- `+ ingredienteA, ingredienteB` quando `item.ingredients?.length`
- `− removidoA, removidoB` quando `item.removedIngredients?.length`
- `Borda: <nome>` quando `item.border`
- `Obs: <texto>` quando `item.observation`

**`src/components/EditOrderDialog.tsx`** — mostrar as mesmas infos abaixo de cada item editável (somente leitura), para o admin ter contexto ao editar.

**`src/lib/exportOrder.ts`** — incluir as mesmas linhas no texto/WhatsApp exportado, no mesmo padrão usado em `printOrder.ts` (linhas 41 e 159 já fazem isso para impressão).

Nenhuma alteração de lógica de negócio, dados ou backend — apenas apresentação.

### Arquivos

- `src/pages/StoreAdminPage.tsx` (2 blocos de coluna "Itens")
- `src/components/EditOrderDialog.tsx` (render do item)
- `src/lib/exportOrder.ts` (montagem do texto)
