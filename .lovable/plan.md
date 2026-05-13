## Objetivo

Adicionar à loja **Dicolore** (e demais lojas tipo LOJA, opcionalmente) a possibilidade de **baixar o pedido** em formato **XML** (layout Tinturaria/Gestor) ou **TXT**, ao lado do botão Imprimir já existente na aba Pedidos do `/dicolore/admin`.

## Alterações de UI

Em `src/pages/StoreAdminPage.tsx`, na linha de ações de cada pedido (onde hoje há o `DropdownMenu` com ícone de impressora), adicionar um segundo `DropdownMenu` com ícone de download (`Download` do lucide-react) e duas opções:

- **Baixar XML (Tinturaria)**
- **Baixar TXT**

O botão aparece para todas as lojas tipo LOJA. (Se quiser restringir só ao Dicolore eu sigo essa orientação.)

## Geração do XML

Criar `src/lib/exportOrder.ts` exportando:

- `exportOrderXml(order, store): string` — retorna a string XML pronta.
- `exportOrderTxt(order, store): string` — retorna texto plano (uma linha por item + cabeçalho).
- `downloadOrderFile(order, store, format)` — gera o arquivo e dispara o download via `Blob` + `<a download>`.

### Mapeamento dos campos XML

Estrutura idêntica ao exemplo enviado:

```text
<dadosGeraisPedido>
  <numero>            ← order.orderNumber (com zero-padding 9 dígitos como no nome do XML exemplo)
  <emissao>           ← order.createdAt → DD/MM/AAAA
  <cgcCliente>        ← order.customer.cpfCnpj (somente dígitos)
  <nomeCliente>       ← order.customer.name
  <cgcRepresentante>  ← store.settings.representante.cgc (vazio se não houver)
  <nomeRepresentante> ← store.settings.representante.nome
  <codigoRepresentante>← store.settings.representante.codigo
  <formaPagamento>    ← código mapeado: pix=1, boleto=2, cartao=3, dinheiro=4 (configurável depois)
  <prazoMedio>        ← store.settings.prazoMedio (default 0)
  <tabelaPrecos>      ← store.settings.tabelaPrecos (default vazio)
  <colunaTabelaPrecos>← 2 (duas casas decimais)
  <itensPedido> (um bloco por CartItem)
    <produto>         ← item.code
    <descProduto>     ← item.name
    <cor>             ← item.color (código se houver, senão vazio)
    <descCor>         ← item.color (código se houver, senão vazio)
    <gtam>            ← item.size (código se houver, senão vazio)
    <descGtam>        ← item.size (código se houver, senão vazio)
    <precoUnitario>   ← item.price (2 casas, ponto)
    <valorTotal>      ← item.price * item.quantity
    <dataEntrega>     ← createdAt + 2 dias DD/MM/AAAA (placeholder, configurável)
    <anoEntrega>      ← ano dessa data
    <periodoEntrega>  ← número da semana ISO
    <listaTamanhos>
      <tamanho>       ← item.size
      <quantidade>    ← item.quantity
```

Campos sem origem nos dados atuais ficam **vazios** (mantendo a tag), preservando o layout do exemplo. Os mapeamentos default ficam concentrados no topo do `exportOrder.ts` para fácil ajuste posterior.

### Formato TXT

Layout simples, legível, com cabeçalho do pedido + uma linha por item separada por `;` (CSV-like):

```
PEDIDO;<numero>;<emissao>;<cgcCliente>;<nomeCliente>;<total>
ITEM;<produto>;<descProduto>;<cor>;<gtam>;<qtd>;<precoUnit>;<valorTotal>
...
```

### Nome do arquivo

Padrão do exemplo: `pedido_<numero9digitos>_<DDMMYYYY>_<HHMMSS>.<xml|txt>`.

## Detalhes técnicos

- Encoding XML: gerar com header `<?xml version="1.0" encoding="UTF-8"?>` e escape de caracteres especiais (`&`, `<`, `>`, `"`).
- Download via `URL.createObjectURL(new Blob([content], { type: 'application/xml' | 'text/plain' }))`.
- Sem dependências novas — implementação pura em TS.
- Sem mudanças de banco, RLS ou edge functions.

## Fora do escopo

- Configuração via UI dos campos de representante / tabela de preços (ficam como constantes/defaults editáveis no código por agora).
- Importação/upload de XML para outro sistema.
- Exportação em massa de vários pedidos.