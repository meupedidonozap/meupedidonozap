## Objetivo

Nenhum produto (ou variação) sem preço válido na tabela do cliente pode aparecer ou ser comprado.

Regra aprovada: para a tabela ativa do cliente (1, 4 ou 9), o preço só é válido se for maior que zero. Se estiver zerado **ou vazio**, o item não aparece — sem herdar preço de outra tabela. Em produtos com variações, some apenas a variação sem preço; se nenhuma variação tiver preço, o produto inteiro some.

## O que muda

**1. Regra de preço (`src/lib/pricing.ts`)**
- Novas funções `getProductPriceOrNull` / `getVariantPriceOrNull`: retornam o valor da tabela ativa apenas se for número > 0, senão `null`.
- Exceção de compatibilidade: para a tabela 4 (padrão de todas as outras lojas), se a coluna T4 estiver vazia, continua usando o preço base — isso evita quebrar lojas de COMIDA/PIZZARIA/SALÃO que nunca preencheram tabelas. Zero explícito continua ocultando.
- As funções atuais `resolveProductPrice` / `resolveVariantPrice` passam a usar a nova base e retornam 0 quando indisponível.

**2. Vitrine (`src/pages/ProductStorePage.tsx`)**
- Antes de montar a lista, calcular a lista de produtos "compráveis": produtos sem variações precisam de preço > 0 na tabela ativa; produtos com variações mantêm só as variações com preço > 0 e são descartados se sobrarem zero.
- Esse resultado alimenta a busca, os cards/lista, o contador e o seletor de variações (variações sem preço não aparecem).
- O menu de categorias passa a considerar somente esses produtos, então categorias que ficarem vazias para aquele cliente desaparecem do menu.
- `handleAddToCart` valida o preço antes de adicionar; se vier inválido, mostra aviso e não adiciona.

**3. Diálogo de variação (`src/components/VariantDialog.tsx`)**
- Recebe a tabela ativa e lista apenas cor/tamanho com preço válido, evitando seleção de combinação sem preço.

**4. Carrinho / Checkout (`src/contexts/CartContext.tsx`, `src/pages/CheckoutPage.tsx`)**
- Ao trocar a tabela de preço do cliente (login/logout), itens do carrinho que ficaram sem preço válido são removidos automaticamente com um aviso: "Alguns itens não estão disponíveis para a sua tabela de preço e foram removidos".
- Isso evita fechar pedido com item indevido vindo do carrinho salvo no navegador.

**5. Painel admin**
- Sem mudança de regra: o admin continua vendo e editando todos os produtos, inclusive os zerados (necessário para corrigi-los).

## Detalhes técnicos

- Nenhuma alteração de banco de dados nem de Edge Function; a regra é aplicada na camada de apresentação/carrinho.
- Visitantes não logados seguem na tabela 4, então passam a não ver produtos com T4 zerado.
- A importação de planilha continua gravando 0,00 quando a coluna vier zerada — é exatamente esse valor que passa a ocultar o item.
