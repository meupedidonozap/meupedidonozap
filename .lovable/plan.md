## Objetivo

1. Mostrar o **Código do Cliente** na tabela de Clientes do painel.
2. Vincular **códigos de vendedor** ao usuário da loja (store_user) para que ele só veja e gerencie clientes/pedidos cujo `seller_code` esteja entre seus códigos atribuídos.

---

## 1) Coluna "Código" na aba Clientes

`src/pages/StoreAdminPage.tsx` (aba Customers, ~linha 1558):

- Adicionar `<TableHead>Código</TableHead>` após "Nome".
- Renderizar `<TableCell>{cp.customerCode || '—'}</TableCell>`.
- O campo já existe em `customer_profiles.customer_code` e já é mapeado em `useStoreCustomerProfiles`.

(Sem alteração de schema; sem alteração no modal de cadastro — o código permanece sendo gerado automaticamente como hoje.)

---

## 2) Vincular códigos de vendedor ao usuário da loja

### 2.1 Banco
Migration:
```sql
ALTER TABLE public.store_users
  ADD COLUMN seller_codes text[] NOT NULL DEFAULT '{}';
```
- Vazio = sem restrição (admins/superadmin continuam vendo tudo).
- Lista preenchida = usuário só enxerga clientes/pedidos daqueles códigos.

### 2.2 Edge function `manage-store-user`
Aceitar `sellerCodes: string[]` nas ações `create` e `update`, persistindo no novo campo.

### 2.3 UI — aba Usuários (`StoreUsersTab.tsx`)
- Nova coluna **"Vendedores"** na tabela, mostrando os códigos como badges (`21, 4, 128`), como no print enviado.
- No diálogo de criar/editar usuário: novo campo **"Códigos de Vendedor"**, popover de múltipla seleção listando todos os `store_sellers` ativos (usar `useAllStoreSellers`) com checkbox por `code+name`. Texto auxiliar: *"Deixe vazio para acessar todos os clientes da loja."*
- `useStoreUsers` / `useCreateStoreUser` / `useUpdateStoreUser`: incluir `seller_codes` no tipo `StoreUser` e nos payloads.

### 2.4 Filtragem na aba Clientes
- Hook `useCurrentStoreUser(storeId)` (novo, simples): busca o registro do usuário logado em `store_users` para obter `seller_codes`.
- Em `StoreAdminPage` (aba Customers), se o usuário **não é** `isAdmin`/superadmin e `seller_codes.length > 0`, filtrar `customerProfiles` por `seller_code ∈ seller_codes` antes de renderizar a tabela.
- Mesmo filtro aplicado aos pedidos (aba Pedidos): mostrar apenas pedidos cujo `customer.sellerCode` ∈ codes do usuário.

### 2.5 Edição de pedido restrita ao código
- No botão de editar pedido (Dicolore, status `pendente`): além das condições atuais, exibir somente se `seller_codes` estiver vazio **ou** se `order.customer.sellerCode` estiver na lista do usuário.
- `EditOrderDialog` continua igual; a proteção é só de visibilidade no front + RLS já existente em `orders`.

---

## Detalhes técnicos

- Filtro é client-side (o RLS atual de `orders`/`customer_profiles` continua permitindo leitura via `has_store_permission`). Para reforço server-side futuro seria necessário policy adicional comparando `customer->>sellerCode` com `store_users.seller_codes` — fica fora desse escopo para não regredir o que já funciona.
- O array de códigos é apenas string (mesmo formato já gravado em `customer_profiles.seller_code` e `store_sellers.code`).
- Admin da loja (`store_admins`) e superadmin (`platform_admins`) **ignoram** o filtro — continuam vendo tudo.

## Fora do escopo
- Mudanças em OS (`service_orders`).
- Tela mobile da Dicolore (a aba Clientes só é usada no admin desktop).