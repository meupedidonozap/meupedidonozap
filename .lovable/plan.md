# DiColore Senses: Tabela 11 sempre

## Situação atual (verificada)

- Existem 10 clientes cadastrados na Senses: 5 com tabela 11 e 5 ainda com tabela 4.
- O cadastro de cliente (painel admin e diálogo do vendedor) nasce com "Tabela 4" pré-selecionado, independentemente da loja.
- O diálogo de cliente do Modo Vendedor nem oferece a opção Tabela 11 (só 1, 4 e 9).
- A vitrine já usa 11 como padrão da Senses para visitante sem cadastro, mas um cliente gravado com tabela 4 passa a comprar na 4.
- O XML usa a tabela gravada no pedido / no cadastro, então herda o mesmo erro.

## O que será feito

1. **Regra fixa da Senses**: na loja DiColore Senses a tabela de preço é sempre 11 — vitrine (com ou sem login), Modo Vendedor, checkout, pedido manual no admin e exportação XML/TXT. Mesmo que o cadastro tenha outra tabela gravada, prevalece a 11.
2. **Cadastro de cliente**: ao abrir o formulário de novo cliente na Senses, o campo Tabela de Preço já vem preenchido com "Tabela 11" (e o diálogo do vendedor passa a listar a opção 11).
3. **Importação/atualização por planilha**: clientes da Senses criados ou atualizados por importação passam a gravar tabela 11.
4. **Correção dos existentes**: os 5 clientes da Senses que estão com tabela 4 serão atualizados para 11.
5. **Conferência**: verificar preço na vitrine e no carrinho para um cliente que estava na tabela 4, e conferir `<tabelaPrecos>11</tabelaPrecos>` no XML de um pedido dessa loja.

Nada muda na DiColore nem nas demais lojas (continuam na tabela 4 / tabela do cadastro).

## Detalhes técnicos

- `src/lib/pricing.ts`: nova função `resolveStorePriceTable(slug, customerTable)` — retorna 11 quando `slug === 'dicoloresenses'`, senão `normalizePriceTable(customerTable, storeDefaultPriceTable(slug))`.
- Passar a usar essa função em `ProductStorePage.tsx`, `CheckoutPage.tsx` (`activePriceTable`, gravação em `orderPayload.customer.priceTable` e fila offline), `NewOrderDialog.tsx`, `EditOrderDialog.tsx` e nos pontos de download em `StoreAdminPage.tsx` (`priceTable` passada a `exportOrder`).
- `StoreAdminPage.tsx`: `customerForm` inicia com `priceTable: storeDefaultPriceTable(store?.slug)`; o rótulo de tabela no rodapé do Modo Vendedor usa a mesma resolução.
- `src/components/SellerCustomerDialog.tsx`: adicionar `SelectItem value="11"` e default do form pela loja.
- `supabase/functions/import-customers` e `sync-customers`: gravar `price_table: 11` quando a loja for `dicoloresenses`.
- Atualização de dados (run_sql): `update customer_profiles set price_table = 11 where store_id = (select id from stores where slug='dicoloresenses')`.
