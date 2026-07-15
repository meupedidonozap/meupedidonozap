## Segmentação por tabela de preço (Dicolore) — sem impacto operacional

Estratégia: adicionar as 3 tabelas (1, 4, 9) em produtos, variantes, clientes e regras de desconto, **backfillando tudo com tabela 4**. A operação continua idêntica até que novas importações tragam dados de outras tabelas.

### 1. Migration (idempotente, sem quebra)

**products**
- `price_table_1 numeric NOT NULL DEFAULT 0`
- `price_table_4 numeric NOT NULL DEFAULT 0`
- `price_table_9 numeric NOT NULL DEFAULT 0`
- Backfill: `price_table_4 = base_price` para todos os registros existentes. `price_table_1` e `price_table_9` também recebem `base_price` como fallback inicial (assim, um cliente tabela 1 ou 9 nunca vê preço zero — só verá preço diferente após nova importação).
- `base_price` permanece — é a fonte de verdade para lojas que não usam segmentação.

**product_variants**
- `price_table_1`, `price_table_4`, `price_table_9` (mesmo padrão, backfill = `price`).

**customer_profiles**
- `price_table smallint NOT NULL DEFAULT 4 CHECK (price_table IN (1,4,9))`.
- Todos os clientes existentes ficam com `4` automaticamente (via DEFAULT no ADD COLUMN).

**Regras de desconto** (em `stores.settings.discountRules` JSONB)
- Novo campo opcional `priceTable?: 1|4|9`.
- Backfill: script na mesma migration percorre `stores.settings->discountRules` e adiciona `"priceTable": 4` em cada regra existente. Regras futuras podem vir com outra tabela ou sem tabela (= todas).

### 2. Runtime (sem mudar comportamento até haver dados)

- Helper `src/lib/pricing.ts`:
  - `getActivePriceTable(customer)` → tabela do cliente logado; default `4` (para visitante).
  - `resolveProductPrice(product, table)` → devolve `price_table_<n>`, com fallback para `base_price` quando `0`/nulo.
  - `resolveVariantPrice(variant, table)` → idem, fallback para `price`.
- Como o backfill preencheu todas as tabelas com o mesmo valor, **qualquer cliente vê exatamente o mesmo preço de hoje** até uma importação diferenciada acontecer.

### 3. Descontos (`src/lib/groupDiscounts.ts`)

- Filtro: aplicar regra se `rule.priceTable == null || rule.priceTable === customer.priceTable`.
- Como toda regra existente foi backfillada com `priceTable = 4` e todo cliente existente é `4`, o comportamento permanece idêntico.

### 4. Tipos (`src/types/index.ts`)

- `Product`, `ProductVariant`: `priceTable1`, `priceTable4`, `priceTable9`.
- `CustomerProfile`: `priceTable: 1|4|9`.
- `DiscountRule`: `priceTable?: 1|4|9`.

### 5. UI Admin (aditiva, não muda o fluxo atual)

- **ProductFormDialog / VariantDialog**: exibir 3 campos (Tabela 1 / 4 / 9). O campo principal "Preço" atual passa a alimentar Tabela 4 e continuar sincronizado com `base_price`, mantendo o mesmo fluxo de digitação para quem não usa segmentação.
- **Regras de desconto** (aba no StoreAdmin): novo seletor "Tabela de preço" (Todas / 1 / 4 / 9), default 4 nas regras já existentes.
- **Clientes** (admin): novo seletor de tabela; cliente final não vê.
- **Imports**: `ImportProductsDialog`, `ImportCustomersDialog`, `ImportDiscountRulesDialog`, `sync-prices`, `sync-customers`, `import-customers` passam a aceitar (opcionalmente) colunas de tabela; ausência → tabela 4.

### 6. Retrocompat garantida

- Lojas que não usam tabelas: nada muda visualmente (os 3 preços são iguais, cliente default = 4).
- Regras backfillada com tabela 4 + cliente default 4 = mesmo resultado de hoje.
- `base_price` continua sendo usado como fallback em toda leitura.

### Detalhes técnicos

- Uma única migration adiciona colunas com DEFAULT (não trava a tabela) e roda o UPDATE de backfill de `price_table_*` e o `jsonb_set` recursivo nas `stores.settings.discountRules`.
- Sem novos GRANTs (colunas em tabelas já existentes herdam permissões).
- `useProducts`, `useCustomerProfile`, mappers de discount rules atualizados para ler/gravar os novos campos.
- `.select().single()` mantido nos updates.

### Ordem de execução

1. Migration (schema + backfill).
2. Tipos + mappers + helper de pricing.
3. Consumo do helper em Cart/Checkout/storefronts/impressão.
4. Filtro por tabela nos descontos.
5. UI admin (produtos, regras, clientes).
6. Imports/sync com colunas de tabela opcionais.
