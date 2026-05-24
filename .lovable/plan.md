## Objetivo

Ajustar duas falhas no fluxo de pedido das lojas tipo delivery (COMIDA/PIZZARIA):

1. No **Resumo do Pedido** (Checkout) o cliente não consegue alterar quantidades nem remover itens.
2. Quando o item tem **variante de tamanho/preço** (ex.: "PASTEL CARNE MOIDA - Grande"), a variante não aparece no resumo, na mensagem do WhatsApp, no TXT, nem na impressão. Aparece só o nome do produto.

## Mudanças

### 1) `src/pages/CheckoutPage.tsx` — Resumo com +/- e variante visível

No bloco "Resumo do Pedido" (atualmente uma linha read-only por item), trocar por linha com:
- Nome + (se houver `item.size` ou `item.color`) sublinha com a variante, ex.: `Tamanho: Grande` / `Cor: Azul`.
- Botões `−` / `+` e botão remover (X), reaproveitando `updateQuantity(productId, qty, variantId)` e `removeItem(productId, variantId)` do `useCart`.
- Manter exibição do `-X%` quando há desconto progressivo.
- Manter limite de altura com scroll (a lista de itens pode crescer).

Sem mudar lógica de totais/cupom/frete.

### 2) `src/lib/formatters.ts` — WhatsApp/TXT com variante

Na assinatura de `generateWhatsAppMessage`, adicionar campos opcionais `size?: string` e `color?: string` ao tipo de cada `item`.

Na montagem da linha do item, quando houver `size` ou `color`, concatenar ao nome:
- Ex.: `• PASTEL CARNE MOIDA (Grande) | 1un | R$ 10,00 | *R$ 10,00*`
- Se houver cor + tamanho: `(Azul · M)`.

No `CheckoutPage.tsx`, no `items.map(...)` que monta `generateWhatsAppMessage`, passar `size: item.size, color: item.color`.

### 3) `src/lib/printOrder.ts` — Impressão térmica e A4 com variante

- **Térmica** (`buildThermalHTML`): hoje existe `const variantLine = ''` placeholder. Preencher com `<div style="padding-left:16px">Tam: ${size} ${color ? '· Cor: '+color : ''}</div>` quando houver `item.size`/`item.color`.
- **A4** (`buildA4HTML`): no array `extras`, incluir `Tamanho: X` / `Cor: Y` quando houver, antes dos demais (ingredientes/borda/obs).

## Detalhes técnicos

- O `CartItem` já possui `size` e `color` (preenchidos pelo `AssemblyDialog` quando o usuário escolhe variante). Logo, basta propagar esses campos da UI até os formatadores.
- Não há mudança em backend, hooks, banco ou tipos.
- Não tocar em `ProductStorePage` nem na lógica da Dicolore — o resumo é o mesmo arquivo (`CheckoutPage.tsx`) e a melhoria beneficia todas as lojas.
- Imagens, regras A-Z, modos lista/grade e demais comportamentos permanecem intactos.