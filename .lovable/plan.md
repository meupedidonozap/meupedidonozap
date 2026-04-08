

# Aplicar descontos de grupo no carrinho + ajustar impressão e WhatsApp

## Problemas identificados

1. **Descontos não aplicam**: Os produtos têm `group_id = null` no banco, mas as regras usam nomes de categorias ("COLORAÇÃO", "FLASH COLOR") como `groupId`. Quando o produto é adicionado ao carrinho, `groupId` vai vazio e o cálculo de desconto ignora o item.

2. **Impressão e WhatsApp mostram Tam/Cor**: A Dicolore não usa variantes (cor/tamanho), mas as colunas aparecem na impressão e na mensagem WhatsApp ocupando espaço.

3. **Desconto não aparece no pedido impresso nem no WhatsApp**: O preço com desconto e o percentual não são exibidos na impressão nem na mensagem.

## Mudanças

### 1. `src/pages/ProductStorePage.tsx` — resolver groupId pela categoria

Na função `handleAddToCart`, quando o produto não tiver `groupId` explícito, usar o **nome da categoria** como fallback:

```typescript
const category = categories.find(c => c.id === product.categoryId);
const resolvedGroupId = product.groupId || category?.name || undefined;
addItem({ ...item, groupId: resolvedGroupId });
```

Isso faz o item no carrinho ter `groupId: "COLORAÇÃO"`, que bate com as regras cadastradas.

### 2. `src/lib/formatters.ts` — WhatsApp sem Tam/Cor e com desconto

- Remover colunas Tam e Cor do cabeçalho e das linhas
- Adicionar `discountPercent` opcional aos itens
- Quando houver desconto, mostrar o preço original riscado e o novo preço
- Formato: `1 | COD123 | Produto | 6 | R$ 47,50 (-5%) | R$ 285,00`

### 3. `src/lib/printOrder.ts` — impressão sem Tam/Cor e com desconto

**Layout térmico:**
- Já mostra desconto (discountPercent) — está correto
- Remover linhas de Tam/Cor

**Layout A4:**
- Remover colunas Tam e Cor da tabela (ficam 6 colunas: #, Produto, Código, Qtd, Preço Unit., Total)
- O desconto por item já é exibido — manter

### 4. `src/pages/CheckoutPage.tsx` — passar desconto na mensagem WhatsApp

Na chamada `generateWhatsAppMessage`, incluir `discountPercent` nos itens:

```typescript
items: cart.items.map(item => ({
  code: item.code, name: item.name, quantity: item.quantity,
  price: item.price,
  discountPercent: itemDiscounts[`${item.productId}-${item.variantId || ''}`] || 0,
})),
```

### 5. `src/pages/CheckoutPage.tsx` — remover Tam/Cor do resumo do checkout

Remover o bloco que exibe `Tam:` e `Cor:` no resumo lateral do pedido.

## Arquivos modificados

- `src/pages/ProductStorePage.tsx` — resolver groupId via categoria
- `src/lib/formatters.ts` — WhatsApp sem Tam/Cor, com desconto
- `src/lib/printOrder.ts` — impressão sem Tam/Cor
- `src/pages/CheckoutPage.tsx` — passar desconto e remover Tam/Cor do resumo

## Resultado esperado

- Ao adicionar 6+ produtos de COLORAÇÃO ao carrinho, desconto de 5% aparece automaticamente
- Desconto progressivo funciona (12=10%, 24=15%, 50=20%)
- Impressão e WhatsApp não mostram colunas Tam/Cor
- Impressão e WhatsApp mostram preço com desconto aplicado

