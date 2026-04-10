

# Correções: Carrinho, Vendedor e Rolagem

## 1. Carrinho: somente botão "+" adiciona ao carrinho

**Problema**: Em `ProductStorePage.tsx`, clicar em qualquer lugar do Card do produto chama `handleProductClick`, que para produtos sem variantes adiciona direto ao carrinho. O usuario pode querer apenas ver detalhes/foto.

**Solução** (`src/pages/ProductStorePage.tsx`):
- Remover o `onClick={() => handleProductClick(product)}` do Card (tanto list view linha 387 quanto grid view linha 405)
- Remover `cursor-pointer` do Card
- Mover o `onClick` para o botão `+` apenas, com `e.stopPropagation()`
- Para produtos com variantes, o botão `+` abrirá o VariantDialog
- O card em si não faz nada ao ser clicado

**FoodStorePage**: Já usa botões explícitos "Adicionar" - nenhuma mudanca necessária.

## 2. Campo "Vendedor" mais evidente

**Problema**: O campo "Enviar pedido para" com o select de vendedor é discreto demais no checkout.

**Solução** (`src/pages/CheckoutPage.tsx`, linhas 410-421):
- Envolver o campo vendedor em um container com borda colorida (border-accent ou border-primary), background sutil, e padding
- Trocar o label para algo mais chamativo como "📱 Enviar pedido para" com fonte maior/negrito
- Adicionar um asterisco `*` indicando obrigatoriedade
- Aplicar para TODAS as lojas que têm sellers configurados (já funciona assim)

## 3. Rolagem na lista de vendedores (Select)

**Problema**: Com muitos vendedores, o dropdown do Select pode não caber na tela, especialmente mobile com teclado aberto.

**Solução** (`src/pages/CheckoutPage.tsx`):
- Adicionar `className="max-h-[200px] overflow-y-auto"` no `SelectContent` do vendedor, garantindo scroll em telas pequenas
- O Radix Select já tem `max-h-96` (384px) por padrao no componente, mas em mobile com teclado aberto isso pode ser muito. Reduzir para `max-h-[40vh]` especificamente neste SelectContent

## Arquivos modificados

- `src/pages/ProductStorePage.tsx` — remover onClick do Card, mover para botao +
- `src/pages/CheckoutPage.tsx` — destacar campo vendedor + scroll no SelectContent

