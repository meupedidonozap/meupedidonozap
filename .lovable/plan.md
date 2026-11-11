# Orçamentos duplicados na DiColore

## O que os dados mostram
Os orçamentos repetidos de hoje vêm todos do mesmo vendedor, com os mesmos itens e o mesmo valor, salvos de 2 a 12 minutos um depois do outro:
- OLINDA SOARES DO NASCIMENTO: #754 (13:24) e #756 (13:35), os dois com R$ 675,80
- MARGARIDA AVI: #748, #750, #751 e depois #757 (R$ 794,54), que é cópia do #755 já transmitido

Nenhum pedido foi salvo duas vezes no mesmo segundo. Então não é o clique duplo: o mesmo carrinho está sendo salvo de novo.

## Causa provável (vou confirmar no primeiro passo)
1. O botão "Salvar Orçamento" abre a finalização com uma marca que salva o orçamento sozinho. Se o vendedor volta para essa tela (botão voltar, troca de app ou recarregar a página), ela salva outra vez.
2. Depois de salvar, o carrinho só é esvaziado 1,2 segundo depois. Se o vendedor sai antes (por exemplo, quando o WhatsApp abre no celular), o carrinho continua cheio. Na próxima vez que ele toca em "Salvar Orçamento", nasce uma cópia.
3. Não existe nenhuma trava que reconheça "este carrinho já virou orçamento".

## O que vou fazer (só na DiColore)
1. Reproduzir o problema no navegador para confirmar a causa: salvar, voltar e recarregar.
2. Salvar automaticamente uma única vez: assim que o orçamento é salvo, a marca de salvar sozinho sai do endereço da página. Voltar ou recarregar não salva de novo.
3. Esvaziar o carrinho e o cliente escolhido logo depois de salvar, sem esperar o tempo de 1,2 segundo.
4. Dar uma identificação única a cada carrinho. Se o mesmo carrinho for enviado de novo, o sistema não cria outro orçamento: avisa "Orçamento já salvo (#numero)" e abre o que já existe.
5. Depois de finalizar ou liberar um pedido, o mesmo carrinho não pode mais virar um orçamento novo.
6. Limpeza dos que já estão duplicados: mostro a lista (por exemplo #756, #757 e #748/#750/#751) e só cancelo os que você aprovar.

## Detalhes técnicos
- A tabela de pedidos já tem uma trava de duplicidade por loja + identificação do carrinho, mas a finalização não manda essa identificação hoje. Gerar a identificação no carrinho e trocá-la só depois que ele é limpo. Quando a trava recusar uma cópia, buscar o pedido que já existe e mostrar o número dele.
- Na finalização, ao rodar o salvamento automático, retirar a marca do endereço sem criar nova entrada no histórico do navegador. Guardar por sessão quais carrinhos já foram salvos.
- Testes: o mesmo carrinho não cria um segundo orçamento, e a marca do endereço não salva de novo quando a tela abre outra vez.
- Atualizar o aviso de nova versão só para a DiColore.
