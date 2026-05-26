## Diagnóstico

No painel ADM da **Pastelaria RM** (`/pastelariarm26/admin`), ao clicar em **Novo Pedido → 2. Itens**, aparece "Nenhum produto encontrado" mesmo com as categorias carregando (ex.: `PASTEL`).

**Causa:** o `NewOrderDialog` decide a fonte do catálogo apenas pelo `store.type`:

```ts
const isFood = store.type === 'COMIDA';
const catalogItems = isFood ? foodItems : products;
```

Mas a Pastelaria RM (apesar de ser do tipo `COMIDA`) cadastra os itens na tabela **`products`** (igual à DICOLORE), não em `food_items`. Confirmado no banco:
- `food_items` da pastelariarm26: **0 registros**
- `products` da pastelariarm26: **65 registros**

A `FoodStorePage` (vitrine do cliente) já usa `useProducts`, por isso lá funciona. Só o diálogo de Novo Pedido no admin usa `foodItems`, que vem vazio.

## Plano

Unificar a fonte do catálogo no `NewOrderDialog` para sempre usar a lista `allProducts` que o `StoreAdminPage` já calcula (na linha 296: `store?.type === 'COMIDA' ? foodItems : products`, com fallback para `products` quando `foodItems` está vazio).

### Alterações

**`src/components/NewOrderDialog.tsx`**
1. Substituir as props `products` e `foodItems` por uma única prop `catalogItems: any[]`.
2. Remover o switch `isFood ? foodItems : products`. Filtrar/buscar/categoria operam sobre `catalogItems`.
3. Ler o preço por item de forma tolerante: `const unitPrice = item.price ?? item.basePrice ?? 0;` (cobre tanto `products` quanto `food_items`).
4. Manter o restante (busca, categoria, carrinho, material de apoio, criação do pedido) sem mudanças funcionais.

**`src/pages/StoreAdminPage.tsx`**
1. Atualizar `allProducts` (linha 296) para: `const allProducts = (store?.type === 'COMIDA' && foodItems.length > 0) ? foodItems : products;` — garante usar `products` quando a loja COMIDA cadastra no catálogo padrão (caso Pastelaria RM).
2. Passar `catalogItems={allProducts}` para `NewOrderDialog` (remover `products` e `foodItems`).

### Não muda
- Schema, RLS, edge functions.
- Fluxo de DICOLORE / outras lojas LOJA / SERVICOS.
- Demais COMIDA que usem `food_items` continuam funcionando (caem no ramo `foodItems`).
- `EditOrderDialog` e demais telas.

### Validação
- Abrir `/pastelariarm26/admin → Novo Pedido → Itens` e confirmar que os 65 produtos aparecem, filtro por categoria `PASTEL` funciona e busca por nome retorna resultados.
- Verificar que DICOLORE continua listando seus produtos normalmente.
