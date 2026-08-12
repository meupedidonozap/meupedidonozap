# Stepper de quantidade sempre visível no modo QUADRO

Hoje, no modo QUADRO, o controle "− qtd +" só aparece depois que o produto entra no carrinho; antes disso o card mostra apenas o botão "+". A mudança é exibir o controle completo em todos os cards, para qualquer quantidade de produtos na vitrine.

## Comportamento

- Todo card do modo QUADRO mostra `− [qtd] +`, começando em 0.
- "+" com quantidade 0 adiciona o produto ao carrinho (quantidade 1).
- "−" reduz; ao chegar em 0 o item sai do carrinho e o controle continua visível mostrando 0.
- "−" fica desabilitado quando a quantidade é 0.
- Produtos ESGOTADOS (com a integração de estoque ligada) mantêm o controle desabilitado.
- Produtos com variações: o "+" continua abrindo o seletor de variação e o número mostra a soma das variações no carrinho; o "−" fica desabilitado nesses casos (ajuste pelo carrinho).
- Sincronização inalterada: o controle lê e escreve direto no carrinho.

## Detalhes técnicos

- `src/pages/ProductStorePage.tsx`, bloco do grid: trocar a condicional `cartQty > 0 ? stepper : botão +` por um stepper único sempre renderizado; o "+" chama `handleProductClick(product)` quando `cartQty === 0` ou o produto tem variantes, e `updateQuantity(product.id, cartQty + 1)` caso contrário.
- Regras de preço zerado por tabela e o filtro de produtos compráveis permanecem inalterados.