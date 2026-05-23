
# Plano — Fase 2: Mesas / Comandas / Garçom (lojas COMIDA)

## 1. Modelo de dados (migration)

Tabelas novas:

- `restaurant_tables` — mesas físicas da loja
  - `store_id`, `number` (int), `label` (text, opcional), `seats` (int default 6), `is_active`
  - unique (store_id, number)

- `table_sessions` — abertura de mesa (uma por mesa por vez)
  - `id`, `store_id`, `table_id`, `status` ('aberta' | 'fechada')
  - `opened_at`, `closed_at`, `opened_by` (uuid → store_user/admin, nullable)

- `table_tabs` — comandas (1..N por sessão; até 6 por mesa)
  - `id`, `session_id`, `number` (int, 1..6), `label` (text, opcional ex: "João")
  - unique (session_id, number)

- `tab_items` — itens lançados na comanda (cada lançamento é uma linha)
  - `id`, `tab_id`, `product_id`, `variant_id` (nullable), `name`, `code`, `unit_price`, `quantity`
  - `ingredients` jsonb, `removed_ingredients` jsonb, `border` jsonb, `observation` text
  - `status` ('pendente' | 'preparo' | 'pronto' | 'entregue' | 'pago' | 'cancelado')
  - `paid_order_id` uuid (FK lógica para `orders.id` quando o item virar pedido pago)
  - `created_at`

RLS: leitura/escrita = `is_store_admin OR has_store_permission(can_manage_orders)`.

## 2. Painel Admin

Nova aba **"Mesas"** em `StoreAdminPage` (somente COMIDA):

- Cadastro inicial: criar/editar mesas (número, etiqueta, ativa).
- Visão "Salão": grid de mesas com estado (livre / ocupada — mostra tempo aberto e subtotal).
- Clicar em mesa abre **TableSessionDialog**:
  - Lista de comandas (até 6). Botão "Adicionar comanda".
  - Cada comanda mostra itens, subtotal, e botão "Lançar item" (abre catálogo COMIDA + AssemblyDialog reaproveitado).
  - Botão "Imprimir conferência" (térmica) — imprime tudo agrupado por comanda.
  - Botão **"Fechar mesa / Pagar"** → abre **PaymentDialog**:
    - Modo "Por comanda": seleciona quais comandas pagar agora.
    - Modo "Por produto": seleciona itens individuais.
    - Mostra subtotal selecionado, escolhe forma de pagamento, gera um **`order`** (status=`entregue`, origem=`mesa`) com os itens selecionados; marca esses `tab_items.status='pago'` e grava `paid_order_id`.
    - Itens não pagos continuam na mesa.
    - Quando todos os itens da sessão estiverem pagos/cancelados, sessão é fechada automaticamente.

## 3. Modo Garçom (storefront)

Nova rota `/:slug/garcom`:

- Tela inicial: grid de mesas (livres x ocupadas), igual visão do admin mas compacto/touch.
- Selecionar mesa → escolher comanda (ou criar nova) → catálogo COMIDA com mesma UX do `FoodStorePage` + `AssemblyDialog`.
- Botão "Enviar pedido" grava `tab_items` (status=`pendente`) e **dispara impressão automática única** (todos os itens recém-lançados na mesma impressão, agrupados por comanda).
- Acesso: requer login de `store_user` com permissão `can_manage_orders` (reaproveita auth existente).

## 4. Impressão

`printOrder.ts` ganha duas novas funções:

- `printTableReceipt(session, tabs, items, mode)` — conferência ou fechamento; agrupa por comanda, mostra subtotal por comanda e total.
- `printTabLaunch(tab, newItems)` — comprovante de envio para cozinha (térmica), uma impressão por lançamento, agrupa por comanda quando vários lançam juntos.

Itens reaproveitam o render de ingredientes/borda/obs da Fase 1.

## 5. Cozinha

`KitchenPage` continua lendo `orders` (sem mesa). Para mesas, ela passa a **também** assinar `tab_items` com status `pendente`/`preparo` via Supabase Realtime e mostrar como cards separados rotulados "Mesa N — Comanda X". Avançar status atualiza `tab_items.status`.

## 6. Tipos e hooks

- `src/types/index.ts`: `RestaurantTable`, `TableSession`, `TableTab`, `TabItem`.
- Hooks novos: `useTables`, `useTableSessions`, `useTabItems` (com mutações para abrir mesa, adicionar comanda, lançar item, marcar pago, fechar mesa).
- Reaproveita `useIngredients`, `usePizzaBorders`, `useProductAssembly`, `AssemblyDialog`.

## 7. Arquivos afetados

- Migration nova (5 tabelas + RLS + sequences).
- `src/types/index.ts`.
- `src/hooks/useTables.ts`, `useTableSessions.ts`, `useTabItems.ts` (novos).
- `src/components/TablesTab.tsx`, `TableSessionDialog.tsx`, `TablePaymentDialog.tsx` (novos).
- `src/pages/StoreAdminPage.tsx` (nova aba "Mesas" para COMIDA).
- `src/pages/WaiterPage.tsx` (novo) + rota em `src/App.tsx`.
- `src/lib/printOrder.ts` (funções de mesa).
- `src/pages/KitchenPage.tsx` (assinar tab_items pendentes).

## 8. Ordem de entrega

1. Migration + tipos + hooks.
2. Cadastro/visão de mesas no admin.
3. TableSessionDialog (abrir mesa, comandas, lançar item).
4. PaymentDialog (parcial por comanda/produto, gera order).
5. WaiterPage + impressão automática no envio.
6. KitchenPage realtime de tab_items.
