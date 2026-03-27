

# Excluir Dados e Validar Rotinas de Status

## Parte 1: Excluir todos os pedidos e OS

Executar via SQL (insert tool):

1. `DELETE FROM service_orders;` — exclui todas as 3 OS
2. `DELETE FROM orders;` — exclui todos os 17 pedidos

## Parte 2: Validar as rotinas de status implementadas

Apos a exclusao, validar o codigo atual verificando cada ponto:

### Verificacao 1: Criacao de OS muda pedido para "confirmado"
- **StoreAdminPage.tsx linha 679**: `await updateOrderStatus.mutateAsync({ id: order.id, status: 'confirmado' })` — **correto**

### Verificacao 2: Sincronizacao de TODOS os status OS → Pedido
- **ServiceOrderDialog.tsx linhas 153-158**: mapeamento completo — **correto**
  - aberta → confirmado
  - em_andamento → preparando
  - concluida → enviado
  - pago → entregue
  - cancelada → cancelado

### Verificacao 3: Status "pago" desbloqueado para selecao com data de pagamento
- **ServiceOrderDialog.tsx**: `isLocked` usa `originalStatus === 'pago'` (status vindo do banco), permitindo selecionar "pago" e definir data antes de salvar — **correto**

### Verificacao 4: Pedidos de lojas SERVICOS com status bloqueado
- **StoreAdminPage.tsx linhas 595-627**: para `store.type === 'SERVICOS'`, mostra badge + botao "Cancelar" condicional (sem Select editavel) — **correto**
  - Sem OS: botao "Cancelar" direto
  - Com OS: exclui OS + cancela pedido

### Verificacao 5: Hook de exclusao de OS
- **useServiceOrders.ts**: `useDeleteServiceOrder` existe e invalida queries corretamente — **correto**

### Verificacao 6: Dashboard faturamento
- Preciso verificar se o calculo de revenue filtra corretamente OS com status "pago" e usa `paid_at` para o periodo

## Resultado

Todas as 5 rotinas do plano anterior estao implementadas corretamente no codigo. Apos excluir os dados, o sistema estara pronto para testes limpos.

