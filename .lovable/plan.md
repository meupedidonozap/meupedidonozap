## Permitir que lojas excluam pedidos cancelados

### Objetivo
Adicionar um botão de "Excluir" (lixeira) ao lado de pedidos com status `cancelado` no painel admin da loja, removendo permanentemente o registro do banco.

### Contexto
- A política RLS de `orders` já permite `DELETE` para `is_store_admin`, então não precisa de migration.
- Falta apenas o hook de exclusão e a UI.

### Mudanças

**1. `src/hooks/useOrders.ts`**
- Adicionar `useDeleteOrder()`: mutation que faz `supabase.from('orders').delete().eq('id', id)` e invalida a query `['orders']`.

**2. `src/pages/StoreAdminPage.tsx` (aba Pedidos, células de status)**
- Para qualquer tipo de loja (LOJA/COMIDA/SERVICOS/etc), quando `order.status === 'cancelado'` e o usuário tem `isAdmin || permissions.can_manage_orders`, exibir um botão lixeira ao lado do badge.
- Ao clicar: `confirm('Excluir permanentemente este pedido cancelado?')` → se SIM, se for SERVICOS e existir OS vinculada, deletar a OS antes; depois `deleteOrder.mutateAsync(order.id)` → `toast.success('Pedido excluído!')`.
- Para SERVICOS: substituir o `return null` final do bloco (linha 859) pelo botão de exclusão quando cancelado.
- Para outros tipos: ao lado do `<Select>` de status, adicionar o botão lixeira condicional quando `status === 'cancelado'`.

### Detalhes técnicos
- Ícone: `Trash2` do lucide-react (já importado em vários lugares; verificar import no arquivo).
- Variant: `ghost`, `size: 'sm'`, classe `text-destructive`.
- Não criar nova migration — RLS DELETE já existe.
- Não tocar em pedidos não-cancelados (manter fluxo de "cancelar" antes de "excluir").