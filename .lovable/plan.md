## Diagnóstico

- A aba **Pedidos** (`StoreAdminPage.tsx` linha 994) já renderiza **todos** os `scopedOrders` (sem `.slice()`), então o admin já tem acesso a todos. O que falta é paginação — com muitos pedidos a tabela fica gigante e lenta.
- O card **"Pedidos Recentes"** do dashboard (linha 811) limita a 10 (`filteredOrders.slice(0, 10)`) — isso é intencional (resumo) e fica como está.
- O hook `useOrders` (em `src/hooks/useOrders.ts`) faz `select('*')` sem `range/limit`, então herda o limite padrão do Supabase de **1000 linhas** por query. Funciona igual para **todas as lojas** (hook compartilhado). Lojas com mais de 1000 pedidos não veriam os mais antigos.

## Solução

### 1. Paginação client-side na aba Pedidos (`src/pages/StoreAdminPage.tsx`)

- Adicionar estado `ordersPage` (default 1) e constante `ORDERS_PAGE_SIZE = 20`.
- Calcular `pagedOrders = scopedOrders.slice((ordersPage-1)*PAGE_SIZE, ordersPage*PAGE_SIZE)` e usar no `<TableBody>`.
- Resetar `ordersPage` para 1 quando filtros (datas/status/busca, se houver) mudarem.
- Adicionar barra de paginação abaixo da tabela: "Página X de Y · Total: N pedidos" + botões «Anterior» / «Próxima» + select de itens por página (20 / 50 / 100).
- Aparece só se `scopedOrders.length > PAGE_SIZE`.

### 2. Quebrar o teto de 1000 no hook (`src/hooks/useOrders.ts`)

- Ampliar para `.range(0, 4999)` (até 5.000 pedidos por loja na listagem) — suficiente para a maioria das lojas sem prejudicar performance. Lojas maiores precisariam de paginação server-side, mas isso é trabalho futuro.

### 3. Verificação multi-loja

- Como `useOrders` é único, a mudança vale para **todas as lojas** automaticamente (LOJA, COMIDA, SERVICOS, ACESSORIOS, PIZZARIA). Não há overrides por tipo.

## Arquivos alterados

- `src/pages/StoreAdminPage.tsx` — estado de paginação + UI de controles + slice do `scopedOrders`.
- `src/hooks/useOrders.ts` — `.range(0, 4999)` na query de listagem.

Sem mudanças de schema, sem mudanças no Dashboard.
