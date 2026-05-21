## Problema

Ao editar um pedido pelo painel admin (`EditOrderDialog`), as regras de desconto progressivo por grupo (definidas em `store.settings.discountRules`) **não são recalculadas**. O campo "Desconto" mostrado no diálogo usa o valor antigo gravado no pedido. Se o admin aumenta a quantidade de um item, a faixa de desconto não muda, e ao salvar o pedido fica com desconto desatualizado.

## Objetivo

A edição deve replicar a mesma lógica de desconto do front da loja (`CartContext.computeGroupDiscounts`): somar a quantidade por `groupId`, escolher a maior faixa aplicável (`minQuantity` ≤ qty total) e aplicar o `discountPercent` em todos os itens daquele grupo. O valor de `discount`, `subtotal` e `total` salvos no pedido devem refletir isso.

## Mudanças

### 1. Extrair função de cálculo reutilizável
Criar `src/lib/groupDiscounts.ts` com `computeGroupDiscounts(items, rules)` (mover a função que hoje vive em `src/contexts/CartContext.tsx`) e fazer o `CartContext` importar dela. Sem mudança de comportamento no front.

### 2. `EditOrderDialog.tsx`
- Receber novas props: `discountRules: DiscountRule[]` e `categories` (para resolver `groupId` de itens novos).
- Ao adicionar produto via `addProduct`, preencher `groupId` no `CartItem` da mesma forma que `ProductStorePage` faz: `product.groupId || category?.name`.
- Recalcular via `useMemo`:
  - `subtotal` = soma `price * qty`
  - `{ quantityDiscount, itemDiscounts }` = `computeGroupDiscounts(items, discountRules)`
  - `discount` final = `quantityDiscount` + `couponDiscount` herdado do pedido original (pedido editado não mexe em cupom)
  - `total` = `subtotal + deliveryFee - discount`
- Exibir no resumo: linha "Desconto por quantidade" e, opcionalmente, badge por item mostrando `% off` (igual ao front).
- No `handleSave`, enviar `discount` recalculado junto com `subtotal`, `items`, `total`.

### 3. `StoreAdminPage.tsx`
- Onde renderiza `<EditOrderDialog … />`, passar `discountRules={store?.settings.discountRules || []}` e `categories`.

### 4. `useUpdateOrder` (`src/hooks/useOrders.ts`)
- Já aceita `discount` opcional — sem mudança.

## Fora do escopo

- Não mexer em cupons (mantém o `couponDiscount` original do pedido).
- Não mexer em pedidos sem `groupId` nos itens (itens legados sem `groupId` simplesmente não recebem desconto, igual ao front).
- Não recalcular frete.

## Arquivos afetados

- novo: `src/lib/groupDiscounts.ts`
- editar: `src/contexts/CartContext.tsx` (importa do novo módulo)
- editar: `src/components/EditOrderDialog.tsx`
- editar: `src/pages/StoreAdminPage.tsx` (passar props)
