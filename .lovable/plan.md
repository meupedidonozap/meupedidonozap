## Situação verificada

A regra "sem preço na tabela do cliente = não vende" hoje só existe na vitrine (`ProductStorePage`), que filtra produtos/variações usando `getProductPriceOrNull`. Os demais caminhos de pedido ignoram a tabela do cliente:

- **Pedido manual no admin (`NewOrderDialog`)**: usa `product.basePrice` e `variant.price` direto, sem olhar a tabela do cliente selecionado — permite vender por outra tabela.
- **Editar pedido (`EditOrderDialog`)**: mesma coisa, adiciona itens por `p.basePrice`.
- **Carrinho (`CartContext`)**: não remove itens quando a tabela de preço muda (login/logout/troca de cliente); o carrinho salvo no navegador pode conter item indisponível.
- **Checkout (`CheckoutPage`)**: usa a tabela só para desconto, não revalida os preços dos itens antes de gravar o pedido.

## O que muda

**1. Pedido manual (`src/components/NewOrderDialog.tsx`)**
- Ao selecionar um cliente existente, ler o `priceTable` dele (já disponível em `CustomerProfile`); cliente novo = tabela 4.
- A lista de produtos passa a mostrar apenas itens com preço válido (> 0) nessa tabela; produtos com variações só listam as variações com preço, e somem se nenhuma tiver.
- O preço adicionado ao pedido vem de `getProductPriceOrNull` / `getVariantPriceOrNull`, nunca de `basePrice`/`variant.price`.
- Mostrar a tabela ativa no cabeçalho da etapa de itens ("Tabela 1/4/9") e bloquear com aviso se o item não tiver preço.
- Ao trocar o cliente depois de já ter itens, revalidar os itens já adicionados e avisar/remover os que ficarem sem preço.

**2. Editar pedido (`src/components/EditOrderDialog.tsx`)**
- Mesma regra: resolver a tabela pelo cliente do pedido e só permitir adicionar produtos com preço válido, usando o preço da tabela.

**3. Carrinho (`src/contexts/CartContext.tsx`)**
- Quando `customerPriceTable` mudar, remover itens sem preço válido na nova tabela e reprecificar os que continuarem válidos, com aviso: "Alguns itens não estão disponíveis para a sua tabela de preço e foram removidos".

**4. Checkout (`src/pages/CheckoutPage.tsx`)**
- Antes de gravar o pedido, revalidar cada item contra a tabela do cliente; se algum estiver sem preço, bloquear o envio com mensagem clara e mandar o cliente revisar o carrinho.

## Detalhes técnicos

- Nenhuma mudança de banco nem de Edge Function; a validação é feita na camada de UI/carrinho reaproveitando `src/lib/pricing.ts`.
- Regra de validade mantida: tabela 1 e 9 exigem valor > 0 (sem herança); tabela 4 cai para `basePrice` só quando a coluna nunca foi preenchida (zero explícito continua ocultando).
- O painel admin de cadastro de produtos continua mostrando/editando todos os preços, inclusive zerados.
