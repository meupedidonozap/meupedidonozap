
# Desconto por Grupo de Produtos no Carrinho

## Diagnóstico da Situação Atual

A estrutura de tipos já existe parcialmente mas está incompleta:

- `DiscountRule` já tem `type: 'group'`, `groupId`, `minQuantity`, `discountPercent` — **estrutura pronta**
- `CartItem` **não possui `groupId`** — precisa ser adicionado para o sistema saber a qual grupo cada item pertence
- `CartContext` tem `quantityDiscount` mas é calculado como valor fixo, sem lógica de grupos
- O painel admin (`StoreAdminPage`) **não tem aba para gerenciar regras de desconto por grupo** — admin não consegue cadastrar as faixas
- A impressão (`printOrder.ts`) não exibe preço original nem percentual de desconto por item

## Como o Sistema Funcionará

### Regras de Negócio

1. Cada produto pertence a um `groupId` (campo já existe na tabela `products`)
2. O admin cadastra faixas por grupo: ex. "Grupo A: 6 peças = 10%, 12 peças = 15%"
3. Ao adicionar/remover itens do carrinho, o sistema soma as quantidades de todos os itens do mesmo grupo
4. A faixa de desconto aplicável é a maior cujo `minQuantity` é atingido
5. O desconto é aplicado em **todos os itens do grupo**, não apenas no último adicionado
6. Cada item terá visualmente: preço original riscado + % desconto + preço com desconto
7. O total do carrinho considera os preços com desconto

### Exemplo Visual no Carrinho

```
ULTRA REPAIR MASCARA       R$ 47,45  (preço original riscado)
Tam: P | Cor: Preto        -10% | R$ 42,71 ← preço real
FLASH COLOR                R$ 47,45
Cor: Azul                  -10% | R$ 42,71 ← mesmo grupo, mesmo desconto
-----------------------------------------------------
Desconto por quantidade: -R$ 9,48
Total:  R$ 85,42
```

## Arquivos a Modificar/Criar

### 1. `src/types/index.ts` — Adicionar `groupId` ao CartItem

```typescript
export interface CartItem {
  productId: string;
  variantId?: string;
  groupId?: string;      // ← NOVO: para cálculo de desconto por grupo
  name: string;
  code: string;
  // ...resto igual
}
```

### 2. `src/contexts/CartContext.tsx` — Lógica de desconto por grupo

**Nova função `applyGroupDiscounts`**: recebe os itens e as regras de desconto. Para cada grupo, soma as quantidades, encontra a faixa aplicável e calcula o desconto total daquele grupo.

```typescript
function applyGroupDiscounts(items: CartItem[], discountRules: DiscountRule[]): {
  quantityDiscount: number;
  itemDiscounts: Record<string, number>; // productId+variantId -> % desconto
} {
  const groupRules = discountRules.filter(r => r.type === 'group');
  let totalDiscount = 0;
  const itemDiscounts: Record<string, number> = {};

  // Agrupa itens por groupId
  const groupMap = new Map<string, CartItem[]>();
  for (const item of items) {
    if (!item.groupId) continue;
    const list = groupMap.get(item.groupId) || [];
    list.push(item);
    groupMap.set(item.groupId, list);
  }

  // Para cada grupo, calcula desconto
  for (const [groupId, groupItems] of groupMap) {
    const totalQty = groupItems.reduce((s, i) => s + i.quantity, 0);
    // Pega a maior faixa cujo minQuantity <= totalQty
    const applicable = groupRules
      .filter(r => r.groupId === groupId && (r.minQuantity || 0) <= totalQty)
      .sort((a, b) => (b.minQuantity || 0) - (a.minQuantity || 0))[0];
    
    if (!applicable) continue;
    const pct = applicable.discountPercent / 100;
    for (const item of groupItems) {
      const itemKey = `${item.productId}-${item.variantId || ''}`;
      itemDiscounts[itemKey] = applicable.discountPercent;
      totalDiscount += item.price * item.quantity * pct;
    }
  }

  return { quantityDiscount: totalDiscount, itemDiscounts };
}
```

O `CartContext` precisará:
- Receber as `discountRules` da loja (via nova função `setDiscountRules`)
- Recalcular os descontos por grupo sempre que os itens mudarem
- Expor `itemDiscounts: Record<string, number>` para que o carrinho mostre o % por item

### 3. `src/pages/ProductStorePage.tsx` — Carregar regras e exibir desconto por item

- Chamar `cart.setDiscountRules(store.settings.discountRules)` quando a loja carregar
- No card de cada item do carrinho, exibir:
  - Preço original riscado (se tiver desconto)
  - Badge com "% OFF"
  - Preço com desconto em destaque
- No rodapé do carrinho, mostrar linha "Desconto por quantidade: -R$ X,XX"

### 4. `src/pages/ProductStorePage.tsx` — Passar `groupId` ao adicionar item

```typescript
addItem({
  productId: product.id,
  variantId: variantData?.id,
  groupId: product.groupId,   // ← NOVO
  // ...
});
```

### 5. `src/pages/StoreAdminPage.tsx` — Nova aba/seção para gerenciar faixas de desconto

Adicionar uma seção "Descontos por Grupo" na aba de Configurações ou como aba própria. O admin poderá:
- Ver os grupos disponíveis (identificados pelo `group_id` dos produtos) — como é um campo livre de texto, o admin digita o ID do grupo
- Adicionar faixas: Grupo ID + Quantidade mínima + % desconto + descrição
- Remover faixas existentes

As regras são salvas em `store.settings.discountRules` (JSONB na coluna `settings` da tabela `stores`).

### 6. `src/lib/printOrder.ts` — Impressão com desconto por item

Os itens do pedido precisarão carregar o desconto aplicado. Serão necessárias duas abordagens:

**Para o modelo A4:** adicionar coluna "% Desc." e mostrar preço original riscado vs preço com desconto

**Para o modelo térmico:** mostrar linha adicional "Desc: X%" e o valor calculado por item

O `Order` salvo no banco já contém `discount` (valor total do desconto) e `items` (os itens). Precisamos salvar `discountPercent` em cada item do pedido para que a impressão consiga reconstruir os valores originais.

### 7. `src/types/index.ts` — Adicionar `discountPercent` ao CartItem/Order item

```typescript
export interface CartItem {
  // ...
  groupId?: string;
  discountPercent?: number;  // ← % de desconto aplicado neste item
}
```

### 8. `src/pages/CheckoutPage.tsx` — Aplicar desconto correto ao salvar pedido

No momento de criar o pedido, o `discount` enviado deve ser `cart.quantityDiscount + cart.couponDiscount`. O resumo do pedido deve mostrar tanto o desconto de quantidade quanto o de cupom separados.

## Resumo das Mudanças

| Arquivo | O que muda |
|---|---|
| `src/types/index.ts` | Adiciona `groupId` e `discountPercent` ao `CartItem` |
| `src/contexts/CartContext.tsx` | Nova lógica `applyGroupDiscounts`, expõe `itemDiscounts` e `setDiscountRules` |
| `src/pages/ProductStorePage.tsx` | Passa `groupId` ao adicionar item; exibe desconto por item no carrinho; carrega regras |
| `src/pages/StoreAdminPage.tsx` | Seção de cadastro de faixas de desconto por grupo |
| `src/lib/printOrder.ts` | Impressão mostra preço original, % desconto e preço com desconto |
| `src/pages/CheckoutPage.tsx` | Separação visual de desconto de quantidade vs cupom no resumo |

## Nenhuma alteração de banco de dados necessária

As regras de desconto são salvas em `stores.settings` (coluna JSONB), que já existe. Não é necessária nenhuma migração.
