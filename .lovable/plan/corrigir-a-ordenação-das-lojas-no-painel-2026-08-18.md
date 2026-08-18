# Corrigir a ordenação das lojas no painel

## O problema (confirmado no banco)
Duas lojas estão com o mesmo número de ordem: **JEWOS Newborn = 0** e **DiColore = 0**.
Como o botão de mover simplesmente troca os números entre as duas lojas vizinhas, trocar 0 por 0 não muda nada — por isso a JEWOS nunca sai da primeira posição.

Ordens atuais: jewosnewborn 0, dicolore 0, dicoloresenses 1, rafas 2, delivery-modelo 3, alphanobre 4, pizzarito 5, lfstore 6, criesolucoes 7, guabacity 8, magui 9.

## O que será feito
1. **Renumerar as lojas** uma única vez (0, 1, 2, ...) na ordem em que aparecem hoje, eliminando o empate.
2. **Tornar o botão de mover à prova de empates**: em vez de trocar os valores existentes, o sistema passa a recalcular a posição de todas as lojas na nova ordem e gravar números sequenciais. Assim, mesmo que dois registros fiquem iguais no futuro, mover para cima/baixo sempre funciona.

## Detalhes técnicos
- Atualização de dados: `UPDATE stores SET sort_order = <índice>` conforme a ordem atual (`sort_order`, depois `created_at desc`).
- `src/hooks/useStores.ts`: substituir `useSwapStoreOrder` por `useReorderStores`, que recebe a lista ordenada de ids e grava `sort_order = índice` para cada loja (updates em sequência, com `.select('id').single()` para validar RLS), invalidando `['stores']` no fim.
- `src/pages/AdminPage.tsx`: `handleMoveStore` passa a montar o novo array (swap de posições no array) e chamar `useReorderStores` com a lista completa.
- Desempate de leitura permanece `sort_order asc, created_at desc`.
