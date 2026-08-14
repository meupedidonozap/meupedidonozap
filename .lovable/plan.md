# Tabela 11 na Senses + ajustes no XML (Tinturaria)

## O que muda

1. **Tabela de preço 11 (Senses)**
   - A Senses passa a ter tabelas de preço próprias, no mesmo modelo da DiColore.
   - Nova tabela **11** disponível em produtos, variações, regras de desconto e no cadastro do cliente.
   - Padrão da loja Senses = **11** (cliente sem tabela definida usa 11); na DiColore o padrão continua **4**.
   - No cadastro do cliente da Senses o seletor passa a oferecer Tabela 11 (além de 1/4/9), então o parceiro pode ser ajustado manualmente.

2. **XML (Tinturaria)**
   - `<tabelaPrecos>` deixa de ser fixo em 11 na Senses: sai sempre a tabela cadastrada no cliente (11 como padrão da Senses, 4 como padrão da DiColore).
   - `<colunaTabelaPrecos>` = **2** nas duas lojas.
   - `<precoUnitario>` com **2 casas decimais** nas duas lojas (hoje sai com 3).
   - `<transportadora>` passa a sair sempre com o código digitado no cadastro do cliente. O campo já existe no cadastro; será validado e o download do pedido passa a buscar esse dado do cliente no momento da geração, inclusive quando o pedido foi criado antes do preenchimento.

## Detalhes técnicos

- Migração: `products.price_table_11 numeric not null default 0`, `product_variants.price_table_11 numeric not null default 0`; ampliar o domínio de `customer_profiles.price_table` para aceitar 11 (mantendo default 4).
- `src/lib/pricing.ts`: incluir 11 no tipo `PriceTable` e na resolução de preço/regra de desconto; fallback por loja (`dicoloresenses` → 11).
- `src/lib/exportOrder.ts`: `colunaTabelaPrecos` fixo em 2; `priceDecimals = 2`; `tabelaPrecos` = `extra.priceTable` (fallback pelo padrão da loja); transportadora vinda de `extra.transportadora`.
- `src/pages/StoreAdminPage.tsx`: seletor de Tabela de Preço com opção 11, colunas T11 na aba Produtos e no formulário; regra de desconto aceita `priceTable: 11`.
- `src/components/ProductFormDialog.tsx`, `ImportProductsDialog.tsx` (coluna `Preco11` na planilha e no download de produtos salvos) e `sync-prices` mapeando a nova coluna.
- Sem alteração no XML Bling nem nas demais lojas.
