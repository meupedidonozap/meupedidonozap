# Senses: preço zerado no painel de Produtos

## O que foi verificado agora

- Os 33 produtos da Senses têm preço na Tabela 11 no banco (ex.: BARBER SHOP 4X4 = 31,00). Nenhum está totalmente zerado.
- A vitrine `/dicoloresenses` já mostra os preços corretos (R$ 31,00, R$ 31,30, ...).
- A lista da aba **Produtos** do painel, aberta com o login administrador da Senses, já exibe a coluna "Preço (Tab. 11)" com os valores certos.
- O que ainda mostra **0,00** é o formulário de produto: 10 produtos (linha BARBER SHOP) têm `base_price` e `price_table_4` iguais a zero, e o campo principal do formulário é "Preço (Tabela 4 — Varejo)". Ao abrir "Editar Produto" na Senses, esse campo aparece zerado mesmo o produto tendo preço na Tabela 11.

## O que será feito

1. **Formulário de produto por loja**: na Senses, o campo principal passa a ser "Preço (Tabela 11)", preenchido com o valor da Tabela 11 do produto. Os campos das tabelas 1, 4 e 9 continuam disponíveis abaixo, como referência.
2. **Salvar sem zerar**: ao gravar na Senses, o valor digitado vai para a Tabela 11; as tabelas 1/4/9 e o preço base não são sobrescritos por zero (mantêm o que já existe).
3. **Preenchimento do preço base**: para os produtos da Senses com `base_price`/`price_table_4` zerados, copiar o valor da Tabela 11 para o preço base, de modo que nenhuma tela auxiliar (impressões, relatórios, exportações antigas) mostre 0,00.
4. **Cache do site publicado**: se após o deploy ainda aparecer valor antigo no navegador do usuário, orientar o acesso com `?limpar` (recurso já existente) para descartar o cache do PWA.
5. **Conferência**: reabrir a aba Produtos e o modal "Editar Produto" de um item BARBER SHOP na Senses e confirmar 31,00 nas duas telas.

Nada muda na DiColore nem nas outras lojas: elas continuam com o campo principal na Tabela 4.

## Detalhes técnicos

- `src/components/ProductFormDialog.tsx`: receber o slug/loja (ou usar `resolveStorePriceTable`) para definir a tabela principal do formulário; rótulo dinâmico e estado inicial vindo de `priceTable11` quando a loja for `dicoloresenses`; no submit, montar o payload de forma que valores existentes de outras tabelas não sejam substituídos por `0`.
- `src/hooks/useProducts.ts` (`useUpdateProduct`): garantir que apenas campos definidos entrem no `updates` (evitar gravar 0 implícito).
- Migração de dados (uma vez): `update products set base_price = price_table_11, price_table_4 = price_table_11 where store_id = (select id from stores where slug='dicoloresenses') and coalesce(base_price,0) = 0 and coalesce(price_table_11,0) > 0`.
