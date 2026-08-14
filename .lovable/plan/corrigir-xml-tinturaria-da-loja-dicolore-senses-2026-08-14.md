# Corrigir XML (Tinturaria) da loja DiColore Senses

## Problema confirmado

Ao gerar o XML no formato "XML (Tinturaria)", o sistema decide se usa o layout da tinturaria olhando **apenas as configurações de pagamento da loja**, e não o identificador da loja. A DiColore tem formas e condições de pagamento cadastradas (5 formas / 14 condições); a Senses está com essas listas **vazias** no banco (ela usa as listas padrão apenas na tela, sem gravar).

Resultado: o arquivo da Senses saiu no layout genérico, e por isso o ERP recusou. Comparando os dois arquivos enviados:


| Campo              | DiColore (ok) | Senses (erro) |
| ------------------ | ------------- | ------------- |
| pedidoTelevendas   | `N`           | `Nao`         |
| tipovenda          | presente      | ausente       |
| transportadora     | presente      | ausente       |
| tabelaPrecos       | `4`           | vazio         |
| colunaTabelaPrecos | `3`           | `2`           |
| perCom (por item)  | presente      | ausente       |
| precoUnitario      | 3 casas       | 2 casas       |


## Correção

1. Passar o identificador da loja (slug) para a geração do XML, de modo que `dicolore` **e** `dicoloresenses` sempre usem o layout tinturaria, independentemente de as listas de pagamento estarem gravadas ou não.
2. Com isso, o XML da Senses volta a trazer: `pedidoTelevendas = N`, `tipovenda`, `transportadora`, `tabelaPrecos`, `colunaTabelaPrecos = 3`, `perCom` por item e preço com 3 casas decimais.
3. Manter os valores de tabela de preço/coluna configuráveis pelas configurações da loja, com o padrão da tinturaria como fallback (a Senses trabalha com coluna diferente da DiColore? confirmar abaixo).

## Detalhes técnicos

- `src/lib/exportOrder.ts`: `exportOrderXml` (e `exportOrderTxt`, para consistência) passam a receber o slug via `StoreLike`/`extra` e chamar `isDicoloreFlow(store.slug, settings)` em vez de `isDicoloreFlow(undefined, settings)`.
- `src/pages/StoreAdminPage.tsx` e demais chamadas de `downloadOrderFile` já dispõem do objeto `store` com `slug`; basta repassá-lo.
- Nenhuma migração de banco necessária.

## Confirmação necessária

Na Senses, `tabelaPrecos` e `colunaTabelaPrecos` devem sair iguais aos da DiColore (`4` e `3`) ou com valores próprios?   
  
Para a SENSES =    
<tabelaPrecos>11</tabelaPrecos>  
<colunaTabelaPrecos>2</colunaTabelaPrecos>  
  
Para a DICOLORE =   
<tabelaPrecos>4</tabelaPrecos> (ou conforme a tabela de preço do cadastro do cliente)  
<colunaTabelaPrecos>2</colunaTabelaPrecos>  
