# Liberar pedido para ERP via WhatsApp (Dicolore)

## Objetivo
Quando, no admin da loja **dicolore**, o status de um pedido for alterado para **"Liberado p/ Transmissão"**, exibir um diálogo de confirmação:

> "Deseja liberar o pedido para o ERP?"

Ao confirmar (**Sim**), abrir em nova aba:
`https://wa.me/5547992491139?text=Olá, o pedido "#<número>" pode ser transmitido`

O usuário (vendedor) então envia a mensagem ao administrador interno fixo. Ao escolher **Não**, o status é atualizado normalmente, mas sem abrir o WhatsApp.

## Escopo
- Aplica-se **exclusivamente** quando `store.slug === 'dicolore'`.
- Aplica-se **somente** ao alterar status para `liberado_transmissao` (qualquer outro status mantém o comportamento atual).
- Não altera regras de banco, RLS, edge functions, nem o fluxo de exportação XML.

## Arquivos a alterar
- `src/pages/StoreAdminPage.tsx` — interceptar o `onValueChange` do `Select` de status (linha ~1109) e o handler do botão "Liberar p/ Transmissão" (linha ~1188, se houver atalho equivalente).

## Implementação (resumo técnico)
1. Adicionar um `AlertDialog` controlado por state local (`pendingErpRelease: { orderId, orderNumber } | null`) no componente.
2. No `onValueChange` do Select de status, antes de chamar `updateOrderStatus.mutateAsync`, verificar:
   - se `store.slug === 'dicolore'` **e** `value === 'liberado_transmissao'` → abrir o AlertDialog e guardar `{ orderId, orderNumber }`.
   - caso contrário → manter o fluxo atual.
3. No AlertDialog:
   - **Sim**: executar `updateOrderStatus.mutateAsync({ id, status: 'liberado_transmissao' })` e, em seguida, `window.open('https://wa.me/5547992491139?text=' + encodeURIComponent('Olá, o pedido "#'+orderNumber+'" pode ser transmitido'), '_blank')`.
   - **Não**: executar apenas o `updateOrderStatus.mutateAsync` (sem abrir WhatsApp).
   - **Cancelar** (X / overlay): não muda o status, fecha o diálogo.
4. Aplicar a mesma checagem em qualquer botão de atalho que defina diretamente `liberado_transmissao` (se existir no fluxo atual).

## Fora do escopo
- Outras lojas continuam com comportamento idêntico ao atual.
- Nenhuma mudança em pedidos vindos da edge function `criar-pedido` ou em notificações push.
- Nenhuma persistência do "liberado" — o WhatsApp é apenas um disparo manual.
