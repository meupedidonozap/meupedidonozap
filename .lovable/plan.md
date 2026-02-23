
# Corrigir Pedidos Não Aparecendo no Painel Admin

## Causa Raiz

No `StoreAdminPage.tsx`, todos os hooks de dados (pedidos, produtos, categorias, etc.) são chamados incondicionalmente nas linhas 87-93, **antes** da verificação de autenticacao:

```text
Linha 87: useCategories(store?.id)     -- busca com token anonimo --> []
Linha 88: useProducts(store?.id)       -- busca com token anonimo --> resultado publico
Linha 90: useOrders(store?.id)         -- busca com token anonimo --> [] (RLS bloqueia)
...
Linha 182: if (!user) return <Login />  -- gate de auth so aparece DEPOIS
```

Os pedidos tem RLS que exige `is_store_admin()`, entao a busca anonima retorna `[]`. Com o `staleTime: 30_000` recem-adicionado, esse resultado vazio fica em cache por 30 segundos apos o login.

## Solucao

Condicionar os hooks de dados protegidos por RLS para so executarem quando `isAdmin` for `true`. Hooks de dados publicos (categorias, produtos) podem continuar como estao.

**Arquivo:** `src/pages/StoreAdminPage.tsx`

**Antes (linhas 90-93):**
```typescript
const { data: orders = [] } = useOrders(store?.id);
const { data: coupons = [] } = useCoupons(store?.id);
const { data: serviceOrders = [] } = useServiceOrders(store?.type === 'SERVICOS' ? store?.id : undefined);
const { data: customerProfiles = [] } = useStoreCustomerProfiles(store?.id);
```

**Depois:**
```typescript
const { data: orders = [] } = useOrders(isAdmin ? store?.id : undefined);
const { data: coupons = [] } = useCoupons(isAdmin ? store?.id : undefined);
const { data: serviceOrders = [] } = useServiceOrders(isAdmin && store?.type === 'SERVICOS' ? store?.id : undefined);
const { data: customerProfiles = [] } = useStoreCustomerProfiles(isAdmin ? store?.id : undefined);
```

## O que muda

- Pedidos, cupons, ordens de servico e perfis de clientes so sao buscados **apos** a confirmacao de que o usuario e admin
- Isso evita a busca com token anonimo que retorna vazio e fica em cache
- Produtos e categorias (que tem leitura publica) continuam carregando normalmente
- Nenhuma mudanca de banco de dados ou RLS

## Impacto

| Cenario | Antes | Depois |
|---|---|---|
| Pedidos apos login | Vazio por 30s (cache) | Aparecem imediatamente |
| Primeira visita sem login | Busca desnecessaria | Nenhuma busca ate autenticar |
