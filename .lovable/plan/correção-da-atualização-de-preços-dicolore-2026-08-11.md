# Correção da atualização de preços (DiColore)

## Problema confirmado

Na rotina de atualização de preços, quando a **Tabela 4 (coluna C) está zerada** na planilha, o sistema hoje **substitui esse zero pelo primeiro preço positivo encontrado** (Tabela 1 ou 9). Por isso o produto DV6132, que tem C = 0 na planilha, aparece no sistema com Preço (Tabela 4) = 12 — herdado da Tabela 1 — e continua disponível para compra, quando deveria ficar oculto para clientes da tabela 4.

Há também um segundo efeito: linhas com **todas** as tabelas zeradas são ignoradas pela rotina. Assim, um produto que passou a ter preço 0 na planilha nunca é zerado no banco — fica com o preço antigo e continua à venda. (Hoje essas linhas também acabam contando como "produto fora da planilha", o que pode inativá-lo indevidamente.)

## O que será corrigido

1. **Zero é zero.** O valor lido da coluna de cada tabela é gravado exatamente como está na planilha: Tabela 1 = coluna B, Tabela 4 = coluna C, Tabela 9 = coluna D. Nenhuma tabela herda preço de outra.
2. **Linhas totalmente zeradas passam a ser processadas**, zerando os preços do produto no banco em vez de serem ignoradas. O produto continua cadastrado e apenas some da vitrine pela regra de preço zerado.
3. **Preço base** passa a acompanhar a Tabela 4 (inclusive quando é 0), mantendo a coerência com a regra de exibição.
4. **Produtos novos** vindos da planilha são criados com os preços exatos, mesmo que alguma tabela venha zerada.
5. O relatório final (toast) continua igual, mas passará a contabilizar corretamente os produtos que tiveram preço zerado.

A regra de vitrine já existente (produto sem preço na tabela do cliente não aparece e não pode ser comprado) não muda — ela passa a funcionar corretamente porque os zeros deixam de ser sobrescritos.

## Detalhes técnicos

- `supabase/functions/sync-prices/index.ts`: remover o fallback `candidates[0]` e o `continue` quando não há preço positivo; usar `Number.isFinite(x) ? x : 0` para cada tabela; `base_price = price4`. A linha só é descartada se não houver código (`procod`).
- Deploy da função `sync-prices` após a alteração.
- Verificação pós-deploy: consultar no banco o código DV6132 e conferir `price_table_4 = 0`, `price_table_1 = 12`, `price_table_9 = 13,2`, e que ele deixa de aparecer para clientes da tabela 4.
