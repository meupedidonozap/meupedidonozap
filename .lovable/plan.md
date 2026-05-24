
## Objetivo

Tornar o módulo Garçom uma experiência completa: login dedicado → mapa de mesas (livres/ocupadas) → abrir mesa e tirar pedido com a MESMA UX do cliente (catálogo da loja conforme o tipo: COMIDA / PIZZARIA / LOJA / ACESSORIOS) → pedido cai no painel de pedidos identificando MESA/Comanda → múltiplos pagamentos parciais até zerar e fechar a mesa automaticamente.

O que já existe e será mantido sem mudanças funcionais:
- Rota `/:slug/garcom` + `WaiterPage` + `TablesTab` (mapa de mesas, abre/fecha sessão, indicador verde = ocupada).
- Múltiplas comandas por mesa (C1…C6).
- Cada item lançado já cria um `orders` com `origem='mesa'` e `customer.name = "MESA X · Cn"` → aparece no painel admin de pedidos identificando a mesa.
- `PaymentDialog` já permite pagar por comanda OU selecionar itens avulsos, com método de pagamento; ao zerar tudo, a sessão fecha sozinha e libera a mesa.

## Mudanças

### 1) Papel GARÇOM dedicado em `store_users`

**Banco** (migração):
- Adicionar coluna `can_manage_tables boolean NOT NULL DEFAULT false` em `store_users`.
- `role` continua texto livre; passa a aceitar `'garcom'` como valor válido na UI.

**`src/hooks/useStoreUsers.ts`**:
- Estender o tipo `role` para `'auxiliar' | 'vendedor' | 'televendas' | 'garcom'`.
- Incluir `can_manage_tables` no `StoreUser`.

**`src/hooks/useStoreAdmin.ts`** (`StorePermissions`):
- Adicionar `can_manage_tables: boolean`.

**`src/components/StoreUsersTab.tsx`**:
- Adicionar opção "Garçom" no `Select` de role.
- Quando role = "garcom", marcar automaticamente `can_manage_tables=true` e `can_view_orders=true` (apenas das mesas dele); demais permissões off por padrão.
- Checkbox visível "Pode gerenciar mesas".

**`supabase/functions/manage-store-user/index.ts`**:
- Aceitar `permissions.can_manage_tables` e `role='garcom'` no insert/update.

**`src/pages/WaiterPage.tsx`**:
- Trocar gate de acesso: liberar quando `isAdmin || permissions?.can_manage_tables` (em vez de `can_manage_orders`).

### 2) Pedido na mesa com UX igual à do cliente

O atual mini-catálogo `catalogOpen` dentro do `TableSessionDialog` será substituído por uma página/rota dedicada que reaproveita os mesmos componentes da loja pública conforme o `store.type`.

**Nova rota**: `/:slug/garcom/mesa/:sessionId/c/:tabId`
- Renderiza um wrapper `WaiterOrderingPage` que detecta `store.type` e monta:
  - COMIDA → `FoodStorePage` em "modo mesa"
  - PIZZARIA → `PizzaStorePage` em "modo mesa"
  - LOJA / ACESSORIOS → `ProductStorePage` em "modo mesa"
- Header substitui logo/banner por barra fixa "MESA X · C{n} — Garçom" + botão Voltar (volta para o `TablesTab`).

**Modo Mesa (flag injetada via context ou prop `waiterMode`)**:
- O `CartContext` é reusado normalmente para montar o pedido.
- Botão "Finalizar pedido" não vai para `/checkout` (que pede endereço/whatsapp); em vez disso chama um handler `submitToTable(tabId)` que:
  - Para cada `CartItem` do carrinho, cria 1 `orders` com `origem='mesa'`, `customer` = `MESA X · Cn`, `paymentMethod=''`, `status='pendente'`.
  - Cria o `tab_items` correspondente apontando `paid_order_id` para o `orders` criado (mesma lógica de `launchAssembled` atual).
  - Limpa o carrinho e volta para `TableSessionDialog`.
- Variantes, montagem, bordas, observação, pizza meia-a-meia: já funcionam nos componentes existentes — herdam tudo de graça.

**`TableSessionDialog.tsx`**:
- Substituir o botão "Lançar item" → navega para a rota acima com `tabId` ativo.
- Remover o `catalogOpen` interno (mini-catálogo) — fica obsoleto.
- O resto (lista de itens da comanda, status, pagamento) permanece igual.

### 3) Painel de pedidos — destaque MESA

**`StoreAdminPage`** (aba Pedidos):
- Já mostra `customer.name` ("MESA 5 · C2"). Adicionar badge visual `Mesa` quando `origem='mesa'` para filtragem rápida.
- Filtro extra "Origem: Mesa" no seletor existente.

### 4) Pagamento (já existe — apenas polir)

- `PaymentDialog` já cobre:
  - Pagamento por comanda inteira
  - Pagamento por item selecionado
  - Múltiplos pagamentos parciais (cada execução marca só os itens escolhidos como `pago`)
  - Auto-fechamento da `table_sessions` quando não restam itens não-pagos
- Ajuste menor: ao abrir `PaymentDialog`, mostrar resumo "Pagos: R$X · Restante: R$Y" no topo para deixar claro o saldo.

## Detalhes técnicos

- Tabelas afetadas: apenas `store_users` (coluna `can_manage_tables`). Tudo demais reutiliza `table_sessions`, `table_tabs`, `tab_items`, `orders` (com `origem='mesa'` já suportada).
- Fluxo de criação do pedido na mesa permanece via `useCreateOrder` + `useAddTabItem` + `useUpdateTabItem({paidOrderId})` — padrão já validado em `launchSimple`/`launchAssembled`.
- RLS: as policies atuais de `orders`, `table_*`, `tab_items` já aceitam `has_store_permission(..., 'can_manage_orders')`. Para o garçom funcionar SEM `can_manage_orders`, ampliar as policies que hoje exigem essa permissão para também aceitar `has_store_permission(..., 'can_manage_tables')` nas tabelas: `table_sessions`, `table_tabs`, `tab_items`, e em `orders` (INSERT/UPDATE para sessões de mesa via `origem='mesa'`). Será incluído na migração.
- Roteamento adicionado em `App.tsx`: `/:slug/garcom/mesa/:sessionId/c/:tabId`.
- Sem alterações em LOJA pública (cliente final). O `waiterMode` é prop opcional, default `false`.

## Resultado

- Garçom faz login no próprio módulo, sem privilégios de admin.
- Vê o salão com mesas livres/ocupadas; abre a mesa, cria N comandas.
- Toca em "Novo pedido" → navega para o catálogo idêntico ao do cliente (com sabores/bordas/variantes conforme o tipo da loja) → finaliza → pedido aparece no painel admin marcado como MESA X · Cn.
- Vários pedidos podem ser adicionados na mesma comanda.
- Cobrança: seleciona itens pagos agora (parcial) ou comanda inteira; ao quitar todos, a mesa fecha automaticamente e fica livre para reabrir.
