## Diagnóstico

Ao confirmar pagamento parcial (1 item de uma comanda) na Pastelaria RM aparece **"Cannot coerce the result to a single JSON object"** e nada é marcado como pago.

**Causa:** ao lançar cada item da comanda, o sistema cria um `orders` "espelho" e grava o id em `tab_items.paid_order_id`. No banco há 4 itens cuja referência aponta para `orders` que **não existem mais** (orphan). No fluxo de pagamento:

```ts
await updateOrder.mutateAsync({ id: i.paidOrderId, status: 'entregue' });
// e
await supabase.from('orders').update({...}).eq('id', i.paidOrderId).select().single();
```

`useUpdateOrder` e a chamada direta usam `.select().single()`. Como o registro não existe, o `update` afeta 0 linhas, o `.single()` quebra com o erro mostrado e o `Promise.all` aborta — nenhum `tab_items.status` é atualizado para `pago`.

A lógica do pagamento parcial em si já está correta:
- Cada item paga individualmente seu `tab_items.status='pago'`.
- A mesa só fecha quando `remaining = items.filter(i => i.status !== 'pago' && i.status !== 'cancelado').length === 0`.
- "Por Comanda" marca todos os itens daquela comanda; "Por Produto" permite escolher um a um.

Ou seja: o requisito (item selecionado vira PAGO, comanda/mesa permanece aberta até todos serem pagos) já está implementado — só precisa parar de quebrar quando o `orders` espelho sumiu.

## Plano

### 1. `src/components/TableSessionDialog.tsx` — `PaymentDialog` `onPay`
- Trocar o `Promise.all` por um loop com **`try/catch` por item**: orphan de um item não pode abortar os demais.
- Para cada item selecionado:
  1. Se houver `paidOrderId`, tentar:
     - `updateOrder.mutateAsync({ id, status: 'entregue' })` (tolerante a falha).
     - `supabase.from('orders').update({ payment_method }).eq('id', paidOrderId)` **sem `.single()`** (apenas verificar `error`, ignorar se 0 linhas).
     - Erros aqui são apenas logados via `console.warn`, não interrompem o fluxo.
  2. Sempre executar `updateItem.mutateAsync({ id: item.id, status: 'pago' })` — esta é a fonte de verdade do item pago.
- Após o loop, contar quantos falharam ao marcar como pago (apenas no passo do `tab_items`). Mostrar `toast.success('Pagamento registrado')` quando ao menos um item foi marcado; mostrar `toast.error` específico se nenhum item conseguiu.
- Manter a regra: só fechar a sessão quando `remaining.length === 0` (todos itens da mesa estão `pago`/`cancelado`).

### 2. `src/hooks/useOrders.ts` — `useUpdateOrder`
- Trocar `.select().single()` por `.select().maybeSingle()`.
- Se `data` vier `null` (linha removida ou bloqueada por RLS), retornar `null` sem atualizar o cache, em vez de jogar erro de "coerce".
- Mantém o `setQueryData` apenas quando há dados.

### 3. Limpeza pontual dos orfãos atuais (migration)
Para os 4 `tab_items` da Pastelaria RM cujo `paid_order_id` aponta para `orders` inexistente, zerar a referência para o fluxo de pagamento não tentar atualizar nada:

```sql
UPDATE tab_items
SET paid_order_id = NULL
WHERE paid_order_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = tab_items.paid_order_id);
```

### Não muda
- Schema/RLS de `orders`, `tab_items`, `table_sessions`, `table_tabs`.
- Lógica de criação do `orders` espelho ao lançar item.
- UI do `PaymentDialog` (abas Por Comanda / Por Produto, seleção, forma de pagamento).
- Fluxo de fechamento automático da mesa.

### Validação
1. Abrir uma mesa da Pastelaria RM com 2+ itens.
2. **Por Produto**: selecionar 1 item, "Confirmar Pagamento" → item vira `pago`, mesa permanece aberta com os demais.
3. **Por Comanda**: selecionar uma comanda inteira → todos os itens dela viram `pago`; se for a única comanda com itens em aberto, a mesa fecha.
4. Pagar o último item → mesa fecha automaticamente.
5. Confirmar que não aparece mais "Cannot coerce..." mesmo nas comandas com referências antigas.
