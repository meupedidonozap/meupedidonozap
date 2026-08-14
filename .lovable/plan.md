# XML Tinturaria: Senses x DiColore — verificação

## Resultado

Gerei o XML do mesmo pedido nas duas lojas e comparei linha a linha: os arquivos são **idênticos**, exceto uma linha.

Campos iguais nas duas lojas:

- `pedidoTelevendas` = `N` / `S`
- `formaPagamento`, `tipovenda`, `transportadora`
- `prazoMedio` e `colunaTabelaPrecos` = `2`
- `perCom` em todos os itens
- `precoUnitario` e `valorTotal` com 2 casas decimais
- Mesma estrutura de `itensPedido` / `listaTamanhos` (36 linhas em ambos)

Única diferença (esperada e confirmada por você):

```text
DICOLORE: <tabelaPrecos>4</tabelaPrecos>
SENSES:   <tabelaPrecos>11</tabelaPrecos>
```

Ela vem da tabela de preço cadastrada no cliente (padrão 11 na Senses, 4 na DiColore).

## Ação

Nenhuma alteração de código necessária — o layout Tinturaria já está unificado para as duas lojas.

Se o ERP recusar um arquivo da Senses, o ponto a checar é o **cadastro do cliente** (CNPJ, código do representante, transportadora e tabela de preço), não o gerador do XML.