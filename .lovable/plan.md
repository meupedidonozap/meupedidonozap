# Garantir a tabela de preço do cliente do carrinho até o XML

## O problema

Hoje a tabela de preço **não fica gravada no pedido**. Na hora de baixar o XML, o sistema tenta "adivinhar" qual cadastro de cliente gerou aquele pedido, procurando por telefone/usuário e escolhendo o cadastro com CPF/código de vendedor mais completo. Quando existe mais de um cadastro para o mesmo telefone (login por código do ERP + login por e-mail, por exemplo), ele pode escolher o cadastro errado — e sai no XML uma tabela diferente da que o cliente usou para comprar.

Além disso há duas inconsistências de padrão:

- Na vitrine, cliente sem tabela definida usa o padrão da loja (11 na Senses, 4 nas demais); no checkout e na exportação, o mesmo cliente cai em 4. Ou seja, o cliente pode comprar com preço da 11 e o XML sair com 4.
- O cadastro do cliente lido no checkout perde os campos Transportadora e Inscrição Estadual (não são carregados), então dependem do "chute" do cadastro na exportação.

## O que será feito

1. **Gravar a tabela no pedido**
   - Todo pedido passa a nascer com a tabela de preço usada na montagem (vitrine, checkout, Modo Vendedor, pedido manual no admin, fila offline).
   - Essa tabela é a do cadastro do cliente; sem cadastro/sem tabela, usa o padrão da loja (11 Senses, 4 demais).

2. **XML e TXT usam a tabela gravada no pedido**
   - `<tabelaPrecos>` passa a sair sempre da tabela gravada no pedido.
   - Só quando o pedido é antigo (sem essa informação) o sistema busca no cadastro do cliente — e nesse caso a escolha do cadastro passa a priorizar: mesmo usuário do pedido > mesmo código de cliente > telefone, em vez de "cadastro mais completo".

3. **Padrão único de tabela**
   - Vitrine, checkout, descontos, kits e exportação passam a usar a mesma regra de resolução da tabela, com o padrão da loja como único fallback.

4. **Cadastro completo no checkout**
   - O perfil carregado no checkout passa a incluir Transportadora e Inscrição Estadual, para o pedido já nascer com esses dados corretos.

5. **Conferência**
   - Verificação com pedidos reais das duas lojas: cliente tabela 4, tabela 1 e tabela 11 — conferindo preço no carrinho, preço gravado no pedido e `<tabelaPrecos>` / preços no XML.

## Detalhes técnicos

- `orders.customer` (JSONB) ganha `priceTable` — sem migração de banco.
- `src/pages/CheckoutPage.tsx`: novo `activePriceTable = normalizePriceTable(customerProfile?.priceTable, storeDefaultPriceTable(store?.slug))`, usado em `useStoreKitMap`, `computeGroupDiscounts` e gravado em `orderPayload.customer.priceTable`; idem no payload da fila offline (`offlineQueue`).
- `src/components/NewOrderDialog.tsx` e `EditOrderDialog.tsx`: gravam/preservam `customer.priceTable`.
- `src/lib/exportOrder.ts`: `tabelaPrecos` = `extra.priceTable` (que o admin passará como `order.customer.priceTable ?? cp?.priceTable ?? padrão da loja`); remove o literal `'11' : '4'` embutido em favor do padrão da loja.
- `src/pages/StoreAdminPage.tsx` (diálogo de download e `EditOrderDialog`): resolução do cadastro com ordem de preferência userId > customerCode > telefone; `priceTable` vinda do pedido primeiro.
- `src/hooks/useCustomerProfile.ts`: `mapProfile` passa a mapear `transportadora` e `ie` e a aceitar fallback de tabela por loja.
