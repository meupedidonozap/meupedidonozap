Diagnóstico do pedido #284:

- Subtotal salvo: R$ 781,00.
- Total salvo: R$ 738,84.
- Desconto salvo: R$ 42,16.
- Desconto visível nas linhas: apenas R$ 12,55, vindo do grupo FLASH COLOR.
- O item 10, MP TOALHA DICOLORE PCT3 UNID, está com grupo MATERIAL DE APOIO e categoria MATERIAL DE APOIO, mas foi salvo sem `discountPercent`.
- Se aplicar 99% no item 10: R$ 29,90 x 99% = R$ 29,60.
- R$ 12,55 + R$ 29,60 = R$ 42,16, fechando exatamente com o total salvo.

Plano de correção:

1. Corrigir a apresentação/impressão/exportação
   - Garantir que pedidos antigos e novos sempre apresentem o desconto correto por linha.
   - Se o pedido já tem `order.discount` salvo, mas algum item não tem `discountPercent`, recalcular/derivar a apresentação com base nas regras atuais da loja antes de imprimir/exportar.
   - Assim a soma das linhas com desconto vai bater com: subtotal sem desconto - desconto = total.

2. Corrigir o pedido #284 no banco
   - Atualizar somente o JSON dos itens do pedido #284 para gravar `discountPercent: 99` no item do grupo MATERIAL DE APOIO.
   - O subtotal, desconto e total já estão corretos; não precisam mudar.

3. Fortalecer a criação/edição de pedidos
   - Garantir que o checkout, novo pedido manual e edição de pedido gravem os itens já com `discountPercent` correto.
   - Hoje o checkout foi ajustado, mas o fluxo administrativo/manual também precisa aplicar a mesma regra para não gerar novos pedidos com desconto total correto e linhas incompletas.

4. Validar a regra de Material de Apoio
   - A configuração atual está ativa: `enabled: true`, `maxPercent: 4`, categoria MATERIAL DE APOIO configurada.
   - Ajustar a validação para a regra literal: permitir Material de Apoio somente se o valor total desses itens for até 4% do total bruto do pedido, antes dos descontos.
   - Aplicar a mesma validação no catálogo, novo pedido manual e edição de pedido.

5. Resultado esperado
   - Pedido #284 passa a mostrar:
     - Subtotal: R$ 781,00
     - Desconto: R$ 42,16
     - Total: R$ 738,84
   - A linha 10 aparece com 99% de desconto e total aproximado de R$ 0,30.
   - A regra de 4% de Material de Apoio continua bloqueando excesso antes de fechar/adicionar o item.