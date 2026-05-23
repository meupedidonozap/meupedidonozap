## Objetivo
Criar o perfil **Garçom** e fazer com que cada item lançado para a mesa apareça imediatamente como **Pedido** no painel admin (com etiqueta "MESA X / Comanda Y") para que o garçom/admin altere o status (recebido → produção → entregue) pela aba Pedidos.

## 1. Perfil "Garçom" (`StoreUsersTab.tsx`)
- Adicionar botão/preset **"Garçom"** no diálogo de criação/edição de usuário que aplica automaticamente:
  - `can_view_orders: true`
  - `can_manage_orders: true`
  - demais permissões `false`
- Mostrar **badge "Garçom"** na listagem quando as permissões batem com esse preset.
- Sem mudança de schema — usa `store_users` existente (a coluna `role` já existe).

## 2. Acesso à tela do Garçom
- No `StoreAdminPage.tsx`, quando o usuário logado tiver apenas permissões de Garçom, redirecionar (ou destacar um botão grande) para `/:slug/garcom`.
- Em `WaiterPage.tsx`, validar permissão `can_manage_orders` (além de admin) para permitir acesso — hoje só permite admin de loja.

## 3. Lançar item da mesa = criar Pedido imediatamente
Em `TableSessionDialog.tsx`, alterar `launchSimple` e `launchAssembled`:
- Continuam gravando em `tab_items` (para o controle da comanda/fechamento).
- **Adicionalmente**, criam um pedido em `orders` com:
  - `origem: 'mesa'`
  - `status: 'pendente'` (entra como "recebido" no painel)
  - `customer.name: "MESA {n} · C{comanda}"` (sem WhatsApp/endereço)
  - `observations: "Mesa {n} - Comanda {c}{label}"`
  - `items: [<o item lançado>]` (1 pedido por item lançado, para o garçom marcar status individualmente)
  - `payment_method: ''`, `delivery_fee: 0`, `total = unitPrice*qty`
- Guardar o `order_id` retornado em `tab_items.paid_order_id` já no lançamento (renomeio conceitual: passa a ser o "pedido vinculado") — assim o pagamento futuro só atualiza o status do pedido para `entregue`/`pago`, sem duplicar.

### Ajuste no fluxo de Pagamento
- Em vez de criar 1 pedido novo na hora de pagar, apenas atualiza os pedidos já vinculados:
  - `status: 'entregue'`
  - `payment_method` escolhido
- Mantém `tab_items.status = 'pago'`.
- Fechar a mesa quando todos itens pagos (já existe).

## 4. Painel Admin — Aba Pedidos (`StoreAdminPage.tsx`)
- Na coluna **Cliente**, quando `order.origem === 'mesa'`, exibir badge laranja **"🍽 MESA"** acima do nome (que já será "MESA X · C1") e ocultar linha de WhatsApp/código.
- Status segue editável pelo Select existente (recebido/produção/entregue/cancelado) — nada a mudar na lógica.
- Pedidos de mesa não-pagos contam normalmente em "Pendentes".

## 5. Tela Garçom — visão dos pedidos da mesa
- Em `TableSessionDialog.tsx`, ao listar os itens da comanda, mostrar o **status atual do pedido vinculado** (badge colorido) e permitir trocar status inline (mesmo Select do admin) quando o usuário tem `can_manage_orders`.
- Assim o garçom faz tudo na tela da mesa sem precisar abrir a aba Pedidos.

## Arquivos afetados
- `src/components/StoreUsersTab.tsx` — preset Garçom + badge
- `src/pages/WaiterPage.tsx` — liberar acesso para usuários com `can_manage_orders`
- `src/pages/StoreAdminPage.tsx` — badge "MESA" na coluna Cliente; redirect opcional p/ Garçom
- `src/components/TableSessionDialog.tsx` — criar pedido ao lançar item; atualizar status no pagamento; mostrar/editar status do pedido por item

## Sem mudança de banco
Reutiliza `orders.origem='mesa'`, `tab_items.paid_order_id`, `store_users` + permissões existentes.