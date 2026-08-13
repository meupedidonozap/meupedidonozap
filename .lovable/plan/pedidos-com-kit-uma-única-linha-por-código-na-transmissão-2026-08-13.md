# Pedidos com KIT: uma única linha por código na transmissão

## Problema

Quando dois KITs diferentes (ou o mesmo KIT em linhas separadas) contêm o mesmo produto, o arquivo de transmissão sai com duas linhas do mesmo código com preços diferentes (ex.: DVSENSES033 com 1x 3,33 e 1x 3,49). Como o código é chave primária no ERP/Bling, a importação e a emissão da NF falham.  
  
Quando tiver Mais de 1 KIT o sistema deve VARRER todos os kits e SOMAR todos os produtos que tiverem o mesmo produto e fazer o calculo da media para o preço e trazer o total de peças, o valor unitario e recalcular o total para este somatorios  
  
6 KITS produto A, 6 KITS produto B, 6 KITS produto C, 6 KITS produto D. No pedido, todos os KITS tem o item DVSENSES033 = 6 peças do A + 6 peças do B + 6 peças do C + 6 peças do D = TOTAL 24 peças do DVSENSES033

## Solução

Na geração dos arquivos de transmissão, após explodir os KITs, agrupar as linhas que tenham o mesmo código (e mesma cor/tamanho, quando houver) em uma única linha:

- Quantidade: soma das quantidades.
- Preço unitário: média ponderada pelo valor total, ou seja `soma(preco x qtd) / soma(qtd)`, com 2 casas.
- O arredondamento é ajustado para que o total da linha continue igual à soma dos totais originais.

Exemplo do anexo: 1 x 3,33 + 1 x 3,49 = 2 x 3,41 (total 6,82) — uma linha só.

## Onde aplica

- XML padrão do pedido
- TXT do pedido
- XML formato Bling

## Onde NÃO aplica

- PDF / impressão do pedido
- Mensagem de WhatsApp
- Tela de detalhe do pedido no painel

Nessas saídas o cliente continua vendo cada componente com a indicação do KIT ao qual pertence, exatamente como hoje.

## Detalhes técnicos

- Novo helper `mergeItemsByCode(items)` em `src/lib/kitExpansion.ts`: agrupa por chave `code|color|size`, soma quantidades e calcula o preço unitário como média ponderada; a diferença de centavos do arredondamento é absorvida no preço unitário da linha para preservar o total.
- Como os itens já chegam com desconto aplicado no preço unitário nas rotinas de exportação, a média é feita sobre o preço efetivo; o campo `discountPercent` é zerado na linha agregada para não descontar duas vezes.
- Em `src/lib/exportOrder.ts`, aplicar `mergeItemsByCode` logo após `expandKitItems` nas três funções: `exportOrderXml`, `exportOrderTxt` e `exportOrderBlingXml`.
- `src/lib/printOrder.ts`, o WhatsApp em `CheckoutPage.tsx` e o detalhe em `StoreAdminPage.tsx` ficam inalterados.