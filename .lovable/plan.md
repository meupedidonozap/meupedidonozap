# Dono do pedido iniciado pelo cliente (DiColore)

## Regra
- O cliente cria e finaliza o pedido. No painel aparece "Feito pelo cliente" para sempre, mesmo depois de editado.
- Enquanto ninguém da equipe salvou o pedido, qualquer vendedor ou televendas da carteira do cliente pode abrir, editar e salvar. O admin também pode.
- Quem salvar primeiro vira o **dono do pedido**. Daí em diante, os outros vendedores e televendas só visualizam: não editam, não finalizam e não liberam. O admin continua podendo tudo.
- No painel aparecem as duas informações: "Feito pelo cliente" e "Assumido por: Ronaldo (vendedor)" ou "Assumido por: Denise (televendas)".
- O vendedor que o cliente escolheu ao enviar o pedido no WhatsApp continua recebendo o aviso. Ele só vira dono quando salvar o pedido, como os demais.

## O que está errado hoje (conferido nos dados e no código)
1. Quando o vendedor salva a edição pela tela de finalização, o pedido é regravado como "Feito por vendedor". O sistema perde a informação de que foi o cliente quem começou.
2. Nesse mesmo caminho, a marca de "assumido por" não é gravada. Por isso a trava depende de outro dado e falha em alguns casos.
3. Pedidos de cliente sem a marca de origem, como o #749 (anterior à atualização), ficam bloqueados para vendedor e televendas, porque o sistema não reconhece que são do cliente e não têm dono.
4. Antes de alguém assumir, o painel mostra como dono o vendedor escolhido no envio, o que confunde com quem de fato assumiu.

## Mudanças
1. Ao salvar uma edição, por qualquer caminho (tela de finalização, edição no painel ou pedidos pendentes do vendedor), manter os dados de quem criou o pedido. Se o pedido for do cliente e ainda não tiver dono, gravar "assumido por" com quem salvou, nome, função e código, e a hora.
2. Antes de salvar, reler o pedido. Se outra pessoa assumiu nesse meio-tempo, bloquear com o aviso "Este pedido já foi assumido por X" e não salvar.
3. Tratar pedidos antigos feitos pela loja com conta de cliente (como o #749) como "do cliente, sem dono".
4. Painel: mostrar o selo "Feito pelo cliente" e, ao lado, "Assumido por ..." quando houver. Na lista do vendedor, os pedidos de outro dono ficam marcados como "somente visualização".
5. Os pedidos antigos, de antes de 09/11, continuam como estão. O dono deles segue a regra que já valia: quem criou, ou o vendedor escolhido.

## Detalhes técnicos
- Funções compartilhadas de dono do pedido: quem criou fica guardado à parte de quem assumiu e nunca é sobrescrito; "sem dono" passa a valer também para pedidos de cliente sem a marca de origem; o dono só existe depois de alguém assumir.
- A tela de finalização, no modo edição, junta os dados de quem criou o pedido salvo com o "assumido por" e confere de novo o dono antes de gravar.
- Trava no banco, só para a DiColore: quando já existe "assumido por", nenhum vendedor ou televendas diferente do dono consegue alterar o pedido, e ninguém consegue apagar ou trocar o "assumido por" (exceto o admin). Assim a regra não depende só da tela.
- Testes: pedido do cliente fica livre até alguém salvar; o primeiro a salvar vira dono; outro membro fica bloqueado; o admin sempre pode; "Feito pelo cliente" continua depois da edição; o #749, sem marca de origem, conta como do cliente.
- Aviso de nova versão só para a DiColore.
