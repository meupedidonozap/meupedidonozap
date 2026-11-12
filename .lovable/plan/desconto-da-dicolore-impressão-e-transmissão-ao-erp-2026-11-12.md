# Desconto da DiColore: impressão e transmissão ao ERP

## O que encontrei
- No **#659**, cada item foi gravado com o percentual de desconto (ex.: 30%) e o pedido tinha o desconto total (R$ 233,61). A impressão mostrava o valor cheio e o desconto, e o ERP recebeu o preço com desconto.
- No **#795**, os 7 itens foram gravados **sem o percentual** e com desconto total R$ 0,00. A impressão calcula o desconto sozinha na tela (mostra R$ 23,75 -5%), mas o total ficou em R$ 708,40 cheio, sem a linha de desconto. A transmissão usa o que está gravado, por isso o ERP recebeu R$ 25,00.
- O cliente EDSON DUARTE **não** está marcado como "sem desconto". O problema está no momento em que o pedido foi gravado.
- Desde 11/11 à tarde, mais pedidos foram gravados sem desconto: **#792** (pendente), **#794** e **#795** (já transmitidos), **#798** e **#800** (orçamentos).

## O que vou fazer (somente DiColore)
1. **Achar a causa exata.** Vou reproduzir a finalização pelo vendedor e conferir em que ponto o desconto some (regras ainda carregando, tabela do cliente ou troca de cliente/edição).
2. **Gravar sempre o desconto.** Ao salvar ou finalizar, o sistema recalcula o desconto de cada item pelas regras e pela tabela do cliente. O pedido só é gravado depois disso, e o total já sai com o desconto. Clientes marcados "sem desconto" continuam sem desconto.
3. **Proteção na transmissão.** Se um item chegar sem percentual, a transmissão aplica a mesma regra antes de enviar. Assim o ERP recebe o preço com desconto (R$ 25,00 com 5% = R$ 23,75), e não o preço de tabela.
4. **Impressão como no #659.** A impressão volta a mostrar Subtotal (valor cheio), Desconto e Total com desconto, usando os mesmos valores enviados ao ERP.
5. **Corrigir os pedidos afetados que ainda não foram transmitidos** (#792, #798, #800): vou recalcular o desconto deles.
6. Vou avisar a equipe da DiColore para atualizar o app.

## Detalhes técnicos
- Checkout: aplicar `ensureItemDiscountPercents` e recalcular `discount`/`total` a partir dos itens gravados, com bloqueio se as regras de desconto ainda não carregaram.
- `orders-export`: buscar `settings.discountRules` da loja e preencher `discountPercent` ausente (respeitando `noDiscount`) antes de calcular `unit_price`.
- `printOrder`/`shareOrderPdf`: derivar Subtotal/Desconto dos itens quando `discount` = 0.
- Teste: R$ 25,00 com 5% resulta em `unit_price` 23,75.

## Preciso da sua decisão
Os pedidos **#794 e #795 já foram transmitidos** com o preço cheio. Eles precisam ser corrigidos direto no ERP, ou você quer que eu os transmita de novo?
