# Correcoes: Dashboard + Fluxo Completo OS-Pedido

## Problema 1: Dashboard contando pedidos cancelados no total

O calculo de `revenue` ja exclui cancelados (linha 151), mas o card **"Total de Pedidos"** conta TODOS os pedidos incluindo cancelados. Isso pode causar confusao. Alem disso, o dashboard deveria idealmente mostrar apenas pedidos "validos" (nao cancelados) no faturamento, e considerar que para lojas de SERVICOS, o faturamento real vem do valor final da OS (que pode ter materiais adicionais).

**Solucao**: O revenue ja esta correto no codigo. Vamos verificar se o problema e de cache/estado. Tambem vamos separar a contagem de pedidos cancelados.

## Problema 2: Fluxo OS-Pedido nao esta integrado

Atualmente, a OS e o pedido sao independentes. O fluxo correto descrito pelo usuario e:

1. Nasce o pedido (status: `pendente`)
2. Gera OS -> status do pedido muda para `preparando`
3. Na OS, inclui materiais -> valor da OS aumenta -> valor do pedido tambem deve ser atualizado
4. Finaliza a OS (status `concluida`) -> pedido muda para `enviado`(finalizado)
5. Somente pedidos `entregue` devem contar no faturamento

### Mudancas necessarias

### Arquivo: `src/pages/StoreAdminPage.tsx`

1. **Dashboard revenue**: Alterar para considerar apenas pedidos com status `entregue` (finalizados):
  ```
   revenue: filteredOrders
     .filter(o => o.status === 'entregue')
     .reduce((sum, o) => sum + o.total, 0)
  ```
2. **Ao gerar OS**: Apos criar a OS com sucesso, atualizar o status do pedido para `preparando`:
  ```
   await updateOrderStatus.mutateAsync({ id: order.id, status: 'preparando' });
  ```

### Arquivo: `src/components/ServiceOrderDialog.tsx`

3. **Ao salvar OS**: Precisa receber `orderId` e a funcao de atualizar pedido. Quando o status da OS mudar para `concluida`:
  - Atualizar o pedido com o novo total (incluindo materiais extras)
  - Mudar status do pedido para `enviado`
4. **Adicionar props**: O dialog precisa receber:
  - `onUpdateOrder`: callback para atualizar o pedido (status + total)

### Arquivo: `src/hooks/useOrders.ts`

5. **Novo hook `useUpdateOrder**`: Criar um hook que permita atualizar tanto o `status` quanto o `total` do pedido (o atual `useUpdateOrderStatus` so atualiza status).

---

## Resumo das mudancas


| Arquivo                                 | Mudanca                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `src/hooks/useOrders.ts`                | Criar `useUpdateOrder` que atualiza status + total                                                |
| `src/pages/StoreAdminPage.tsx`          | Revenue so conta `entregue`; ao gerar OS muda pedido para `preparando`; passar callback ao dialog |
| `src/components/ServiceOrderDialog.tsx` | Ao concluir OS, atualizar pedido com novo total e status `enviado`                                |


## Detalhes tecnicos

### Novo hook `useUpdateOrder` em `useOrders.ts`:

```
export function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, total }: { id: string; status?: OrderStatus; total?: number }) => {
      const update: any = {};
      if (status) update.status = status;
      if (total !== undefined) update.total = total;
      const { error } = await supabase.from('orders').update(update).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}
```

### ServiceOrderDialog - nova prop e logica:

- Receber `onOrderUpdate?: (params: { orderId: string; status: string; total: number }) => Promise<void>`
- No `handleSave`, se status for `concluida` e existir `orderId`, chamar `onOrderUpdate` com status `entregue` e o total atualizado
- Se status for `cancelada`, chamar `onOrderUpdate` com status `cancelado`

### StoreAdminPage - ao gerar OS:

- Apos `createServiceOrder.mutateAsync(...)`, chamar `updateOrderStatus.mutateAsync({ id: order.id, status: 'preparando' })`

### StoreAdminPage - passar callback ao dialog:

- Criar funcao que usa `useUpdateOrder` para atualizar o pedido
- Passar como prop `onOrderUpdate` ao `ServiceOrderDialog`