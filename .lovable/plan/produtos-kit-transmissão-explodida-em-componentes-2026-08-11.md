# Produtos KIT: transmissão explodida em componentes

## Objetivo

Permitir marcar um produto como KIT e definir quais produtos da loja o compõem (com quantidade). O cliente compra e vê o KIT normalmente, mas na hora de gerar o pedido os componentes é que aparecem — nunca o código do KIT.

Exemplo: KITS001 vendido a R$ 143,68, composto por 3 itens de R$ 59,90 (soma cheia R$ 179,70). Na transmissão saem os 3 códigos, com o valor do kit rateado proporcionalmente ao preço cheio de cada um. Comprando 2 kits, todas as quantidades dobram; se o kit tem 3x o mesmo item e o cliente leva 3 kits, saem 9 peças desse item.

## Cadastro (painel)

- No modal de produto, novo bloco "Este produto é um KIT".
- Ao ligar: busca de produtos da loja por código/nome, adiciona componentes com quantidade por kit, permite remover e editar quantidade.
- Mostra a soma dos preços cheios dos componentes e o preço de venda do kit, para conferência.
- Disponível em todas as lojas.

## Onde o KIT é explodido

- Arquivo de transmissão do pedido (XML e TXT).
- Mensagem de WhatsApp do pedido.
- Impressão / PDF do pedido.
- Tela de detalhe do pedido no painel.

Carrinho, vitrine e checkout continuam exibindo o KIT como um único item — a explosão acontece na geração de cada saída.

## Regra de rateio

Rateio proporcional ao preço cheio de cada componente:

```text
peso_i   = preco_cheio_i x qtd_no_kit_i
valor_i  = preco_kit x (peso_i / soma_dos_pesos)
unitario = valor_i / qtd_no_kit_i, com 2 casas
```

A sobra de centavos do arredondamento é lançada no último componente, de modo que a soma dos componentes bata exatamente com o valor do kit vendido. Se algum componente estiver sem preço cheio, o rateio para esse kit cai para divisão igual entre os componentes.

Quantidade transmitida de cada componente = quantidade no kit x quantidade de kits comprados. Componentes repetidos dentro do mesmo kit são somados numa única linha.

## Detalhes técnicos

- Nova tabela `product_kit_items` (produto kit, produto componente, quantidade), com GRANTs, RLS de gestão por admin da loja e leitura pública alinhada à leitura de produtos.
- `products` ganha flag `is_kit`.
- Novo hook de leitura/gravação da composição, consumido pelo `ProductFormDialog`.
- Novo helper `src/lib/kitExpansion.ts` com `expandKitItems(items, kitMap)` devolvendo linhas já rateadas e agregadas; usado por `src/lib/exportOrder.ts` (XML e TXT), pela geração da mensagem de WhatsApp em `CheckoutPage.tsx`, por `src/lib/printOrder.ts` e pelo detalhe de pedido em `StoreAdminPage.tsx`.
- Pedidos antigos, sem composição cadastrada, continuam saindo com o próprio código do kit (comportamento atual preservado).
