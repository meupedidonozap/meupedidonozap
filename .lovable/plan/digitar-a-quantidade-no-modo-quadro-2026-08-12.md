# Digitar a quantidade no modo QUADRO

No modo QUADRO, o número entre os botões "−" e "+" passa a ser um campo editável, para permitir quantidades grandes (ex.: 24) sem ficar clicando várias vezes. Tanto no Quadro quanto no CARRINHO

## Comportamento

- Os botões "−" e "+" continuam exatamente como estão hoje.
- O número no meio vira um campo de digitação (numérico, centralizado, mesma aparência atual).
- Ao digitar um número e sair do campo (ou pressionar Enter), o carrinho é atualizado para aquela quantidade.
- Digitar 0 (ou apagar tudo) remove o item do carrinho e o campo volta a mostrar 0.
- Valores inválidos ou negativos são tratados como 0.
- No celular, o teclado abre em modo numérico.
- Clicar no campo não abre a página/seletor do produto.
- Produtos ESGOTADOS (com integração de estoque ligada) mantêm o campo desabilitado.
- Produtos com variações: o campo continua somente leitura (a quantidade é a soma das variações); alterações seguem pelo seletor de variação ou pelo carrinho.

## Detalhes técnicos

- `src/pages/ProductStorePage.tsx`, bloco do grid: trocar o `<span>` da quantidade por um `<input type="number" inputMode="numeric">` com estado local do texto digitado, sincronizado com `cartQty` do `CartContext`.
- Commit no `onBlur` e no `onKeyDown` (Enter) chamando `updateQuantity(product.id, n)`; quando `cartQty === 0` e `n > 0`, adicionar o item ao carrinho pelo mesmo caminho do botão "+" e então ajustar a quantidade.
- `e.stopPropagation()` nos eventos do input para não disparar o clique do card.