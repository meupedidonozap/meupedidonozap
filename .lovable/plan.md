## Diferenças encontradas

Comparando o arquivo de referência (que o ERP lê corretamente) com o gerado hoje em `src/lib/exportOrder.ts`:

1. **Tag `<condicaoPagamento>` não existe no arquivo correto** — o atual gera essa tag entre `<formaPagamento>` e `<prazoMedio>`, e isso é o que está quebrando a leitura.
2. **`<pedidoTelevendas>` deve ser `Sim` / `Não`** — hoje sai `Sim` / `Nao` (sem acento).

A ordem correta da seção de pagamento, conforme a referência, é:
```
<formaPagamento>3</formaPagamento>
<prazoMedio>0</prazoMedio>
<tabelaPrecos></tabelaPrecos>
<colunaTabelaPrecos>2</colunaTabelaPrecos>
```

## Ajuste

Em `src/lib/exportOrder.ts`:

- Remover a linha `<condicaoPagamento>...</condicaoPagamento>` da geração do XML.
- Trocar `Nao` por `Não` no valor de `<pedidoTelevendas>` (XML e TXT).

Nada mais é alterado: itens, datas, semana ISO, representante, cliente, totais e nome do arquivo continuam iguais. A UI do diálogo de baixar pedido (toggle "Pedido Tele-Vendas") também permanece como está.

## Fora do escopo

- Não mexer em `DicolorePaymentCodesTab`, na coluna `paymentCondicaoCodigo` salva no pedido (continua existindo no banco, só deixa de ser escrita no XML), nem em qualquer outro fluxo.
