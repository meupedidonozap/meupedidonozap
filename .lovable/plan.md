
# Exibir Cor e Tamanho em Todos os Layouts de Pedido

## Problema

Os campos `color` e `size` existem em cada `CartItem` (definidos em `src/types/index.ts`), mas **nenhum** dos layouts de visualização os exibe:

1. **"Meus Pedidos" (cliente)** — `OrderHistoryPage.tsx` linha 92: exibe apenas `{item.quantity}x {item.name}`, sem cor/tamanho
2. **WhatsApp / TXT** — `formatters.ts` linha 116: a linha do item usa só `item.name`, os campos `color` e `size` são ignorados
3. **Impressão Térmica (80mm)** — `printOrder.ts` linha `buildThermalHTML`: a linha de detalhes já inclui `size` e `color` com `details.push()`, mas **só aparece se `item.code` existir** (condição separada); funciona, mas precisa verificar
4. **Impressão A4** — `printOrder.ts` linha `buildA4HTML`: a célula de produto já inclui `(${details.join(', ')})` com size e color, mas o campo `code` aparece em coluna separada
5. **Resumo no Checkout** — `CheckoutPage.tsx` linha 316: exibe `{item.quantity}x {item.name.slice(0, 25)}...`, sem cor/tamanho
6. **Painel Admin (lista de pedidos)** — exibe apenas a quantidade de itens (`X itens`), sem detalhes

## Análise do que já funciona

Verificando `printOrder.ts`:
- **Térmica**: A seção de detalhes já captura `size` e `color` com `details.push()` — está correto
- **A4**: A célula do produto já inclui `(size, color)` — está correto

Os problemas estão em:
1. `OrderHistoryPage.tsx` — tela "Meus Pedidos" do cliente
2. `formatters.ts` — mensagem do WhatsApp e arquivo TXT
3. `CheckoutPage.tsx` — resumo lateral do carrinho no checkout

## Mudanças por arquivo

### 1. `src/pages/OrderHistoryPage.tsx`
Linha 92 — adicionar cor e tamanho abaixo do nome:

```
Antes: {item.quantity}x {item.name}
Depois:
  {item.quantity}x {item.name}
  (P, Amarelo)  ← se existirem
```

```tsx
<span className="text-muted-foreground">
  {item.quantity}x {item.name}
  {(item.size || item.color) && (
    <span className="text-xs ml-1 opacity-70">
      ({[item.size, item.color].filter(Boolean).join(', ')})
    </span>
  )}
</span>
```

### 2. `src/lib/formatters.ts`
Função `generateWhatsAppMessage` — linha 116. Alterar a linha do item para incluir cor e tamanho no nome do produto:

```
Antes: ${item.name.slice(0, 20)}...
Depois: ${item.name}${item.size ? ` [${item.size}]` : ''}${item.color ? ` [${item.color}]` : ''}
```

O tipo do item na assinatura da função precisa incluir os campos opcionais `size` e `color`:
```typescript
items: Array<{
  code: string;
  name: string;
  quantity: number;
  price: number;
  size?: string;
  color?: string;
}>;
```

E no `CheckoutPage.tsx` linha 148, passar os campos ao chamar a função:
```typescript
items: cart.items.map(item => ({
  code: item.code,
  name: item.name,
  quantity: item.quantity,
  price: item.price,
  size: item.size,
  color: item.color,
})),
```

### 3. `src/pages/CheckoutPage.tsx`
Resumo lateral (linha 314-320) — adicionar cor e tamanho abaixo do nome do item:

```tsx
<div key={...} className="flex justify-between text-sm">
  <div className="text-muted-foreground">
    <span>{item.quantity}x {item.name}</span>
    {(item.size || item.color) && (
      <div className="text-xs opacity-70">
        {[item.size, item.color].filter(Boolean).join(', ')}
      </div>
    )}
  </div>
  <span>{formatCurrency(item.price * item.quantity)}</span>
</div>
```

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/pages/OrderHistoryPage.tsx` | Exibir cor e tamanho na lista de pedidos do cliente |
| `src/lib/formatters.ts` | Incluir cor e tamanho na mensagem do WhatsApp/TXT |
| `src/pages/CheckoutPage.tsx` | Exibir cor e tamanho no resumo lateral + passar campos ao gerar mensagem |

## O que NÃO precisa mudar

- `src/lib/printOrder.ts` — os dois layouts (térmica e A4) já exibem cor e tamanho corretamente nos detalhes de cada item

## Exemplo do resultado no WhatsApp

```
Antes:
1 | LS0007 | Camiseta Super Mario... | 3 | R$ 49,90 | - | R$ 149,70

Depois:
1 | LS0007 | Camiseta Super Mario [M] [Amarelo] | 3 | R$ 49,90 | - | R$ 149,70
```

## Exemplo na tela "Meus Pedidos"

```
Antes:
3x Camiseta Super Mario                         R$ 149,70

Depois:
3x Camiseta Super Mario (M, Amarelo)            R$ 149,70
```
