## Problema

Ao logar com um usuário **GARÇOM** (perfil `can_manage_tables = true`) na loja Pastelaria RM (tipo COMIDA / delivery), ele é levado para `/:slug/admin`, mas a aba **Mesas** só aparece quando o usuário é admin principal. Resultado: o garçom não tem como abrir mesas nem lançar produtos nas comandas.

A página `/:slug/garcom` (WaiterPage) já existe e mostra o `TablesTab` completo (abrir mesa → comandas → lançar produtos do cardápio → cobrar). O problema é só de visibilidade/roteamento.

## Solução

Duas mudanças pequenas, sem mexer em lógica de negócio:

### 1. Mostrar a aba "Mesas" no admin também para o garçom

Em `src/pages/StoreAdminPage.tsx` (linha ~686), trocar:

```text
store.type === 'COMIDA' && isAdmin
```

por:

```text
store.type === 'COMIDA' && (isAdmin || permissions.can_manage_tables)
```

Assim, quem tem permissão de Garçom vê a aba Mesas dentro do painel admin e consegue abrir mesa / lançar produtos da comanda igualmente.

### 2. Redirecionar o garçom direto para a tela de Mesas após login

Quando o usuário logado **só** tem `can_manage_tables` (preset Garçom — sem ver pedidos, produtos, clientes, OS), redirecionar automaticamente de `/:slug/admin` para `/:slug/garcom`, que é a interface enxuta já existente focada em mesas.

Em `src/pages/StoreAdminPage.tsx`, adicionar um `useEffect` logo após o `useStoreAdmin`:

```text
if (!isAdmin && permissions.can_manage_tables &&
    !permissions.can_view_orders && !permissions.can_manage_orders &&
    !permissions.can_manage_products && !permissions.can_view_customers &&
    !permissions.can_view_service_orders && !permissions.can_manage_service_orders) {
  navigate(`/${slug}/garcom`, { replace: true });
}
```

Garçom "puro" cai na tela `/garcom` (já implementada, mostra mesas em grade com botão Abrir). Garçom com permissões extras (ex.: também vê pedidos) continua no admin, agora com a aba Mesas visível.

## Fluxo final do GARÇOM

1. Login em `/:slug/admin` com email/senha do garçom.
2. Redirecionamento automático para `/:slug/garcom`.
3. Clica em **Abrir** numa mesa → diálogo de Comandas.
4. Clica em **+ Comanda** e depois em **Novo pedido (cardápio)** ou **Avulso** para lançar produtos.
5. Cada item lançado gera um pedido vinculado à mesa/comanda.
6. Ao final, clica em **Pagar** → registra pagamento e fecha a sessão da mesa.

## Arquivos a alterar

- `src/pages/StoreAdminPage.tsx` — condição da aba Mesas + redirecionamento do garçom puro.

Sem mudanças de schema, RLS ou edge functions.
