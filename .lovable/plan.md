

# Ajustar Rotinas de Status para Lojas SERVICOS (Rafa's)

## Resumo

5 ajustes no fluxo de status entre Pedidos e Ordens de Serviço para lojas do tipo SERVICOS.

## Mudancas

### 1. Dashboard: faturamento apenas de OS com status "pago" (ja funciona)

O codigo atual em `StoreAdminPage.tsx` linha 179 ja filtra `so.status === 'pago'`. Para lojas SERVICOS, o faturamento de pedidos `entregue` tambem ja e somado. Nenhuma mudanca necessaria aqui — o comportamento ja esta correto.

### 2. ServiceOrderDialog: desbloquear status "pago" para permitir data de pagamento

Atualmente `isLocked = status === 'pago'` bloqueia tudo quando o status e "pago". Preciso mudar para que:
- O status "pago" possa ser selecionado normalmente
- O campo de data de pagamento apareca e seja editavel
- Apos salvar como "pago", ai sim bloquear edicao (ou seja, bloquear apenas se o status **ja veio** como "pago" do banco, nao quando o usuario acabou de selecionar)

**Arquivo:** `src/components/ServiceOrderDialog.tsx`
- Mudar `isLocked` para comparar com o status **original** da OS (vindo do banco), nao o status local do formulario
- Adicionar estado `originalStatus` inicializado junto com os outros campos

### 3. ServiceOrderDialog: sincronizar TODOS os status OS → Pedido

Atualmente so sincroniza `pago/concluida → entregue` e `cancelada → cancelado`. Preciso mapear todos:

| Status OS | Status Pedido |
|-----------|--------------|
| aberta | confirmado |
| em_andamento | preparando |
| concluida | enviado |
| pago | entregue |
| cancelada | cancelado |

**Arquivo:** `src/components/ServiceOrderDialog.tsx` — alterar o bloco `handleSave` (linhas 149-155)

### 4. Pedidos: bloquear alteracao de status para lojas SERVICOS

Na aba Pedidos (`StoreAdminPage.tsx` linhas 594-609), o Select de status permite alterar livremente. Para `store.type === 'SERVICOS'`:
- Mostrar apenas o badge do status (sem Select editavel)
- Permitir apenas "Cancelar" se **nao** tiver OS vinculada
- Se tiver OS vinculada e quiser cancelar: excluir a OS primeiro, depois cancelar o pedido

**Arquivo:** `src/pages/StoreAdminPage.tsx` — substituir o Select de status na coluna de pedidos por logica condicional

### 5. Criacao de OS: status do pedido vai para "confirmado" (nao "preparando")

Atualmente ao gerar OS (linha 641), o pedido vai para `preparando`. Pela nova regra, ao criar a OS (que nasce com status `aberta`), o pedido deve ir para `confirmado`.

**Arquivo:** `src/pages/StoreAdminPage.tsx` — linha 641, trocar `'preparando'` por `'confirmado'`

### 6. Hook: adicionar mutacao para excluir OS

Para o caso de cancelar pedido com OS vinculada, preciso de uma funcao para deletar a OS.

**Arquivo:** `src/hooks/useServiceOrders.ts` — adicionar `useDeleteServiceOrder` mutation

## Fluxo final

1. Pedido nasce como **Pendente**
2. Admin clica "Gerar OS" → OS criada como **Aberta**, pedido vai para **Confirmado**
3. Na OS, admin muda status → pedido acompanha automaticamente
4. Na aba Pedidos, admin so pode **Cancelar** (se nao tiver OS) — demais status sao controlados pela OS
5. Se quiser cancelar pedido com OS: sistema exclui a OS e cancela o pedido

