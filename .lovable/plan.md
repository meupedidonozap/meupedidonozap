
# Dashboard: Excluir Cancelados do Faturamento + OS com Numero do Pedido

## Problema 1: Faturamento inclui pedidos cancelados

O calculo de `revenue` no dashboard soma o total de **todos** os pedidos filtrados, incluindo os cancelados. No exemplo da imagem, o pedido #12 (R$ 80,00 - Cancelado) esta sendo somado ao faturamento.

### Correcao

No arquivo `src/pages/StoreAdminPage.tsx`, linha 151, alterar o calculo de revenue para excluir pedidos com status `cancelado`:

```
revenue: filteredOrders
  .filter(o => o.status !== 'cancelado')
  .reduce((sum, o) => sum + o.total, 0),
```

## Problema 2: OS deve usar o mesmo numero do pedido

Atualmente a OS recebe um numero sequencial proprio (`os_number` via `nextval`). O usuario quer que, ao gerar uma OS a partir de um pedido, a OS use o mesmo numero do pedido de origem.

### Correcao

1. **`src/hooks/useServiceOrders.ts`** - No `useCreateServiceOrder`, passar o `orderNumber` como parametro e incluir no insert como `os_number`:

   - Adicionar `orderNumber?: number` aos parametros
   - No insert, adicionar `os_number: params.orderNumber` (quando fornecido)

2. **`src/pages/StoreAdminPage.tsx`** - No botao "Gerar OS" (linha ~505), passar `orderNumber: order.orderNumber` para o `createServiceOrder.mutateAsync`.

3. **Migracao SQL** - Alterar a coluna `os_number` para permitir valor manual (remover NOT NULL default ou tornar o default opcional). Como o default ja e um `nextval`, basta passar o valor explicitamente no insert que o Postgres usara o valor fornecido em vez do sequence. Nenhuma migracao necessaria.

---

## Arquivos a modificar

| Arquivo | Mudanca |
|---|---|
| `src/pages/StoreAdminPage.tsx` | Excluir cancelados do revenue; passar `orderNumber` ao gerar OS |
| `src/hooks/useServiceOrders.ts` | Aceitar e usar `orderNumber` no insert da OS |
