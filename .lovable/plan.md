## Corrigir sync-prices para a nova planilha (3 tabelas)

### Causa do erro
`supabase/functions/sync-prices/index.ts` procura a coluna `protabpre` no CSV. A nova planilha da Dicolore tem `Preço 1`, `Preço 4`, `Preço 9`, `Descrição PRoduto`, `GRUPO`. Header não encontrado → função retorna HTTP 400 → toast "Edge Function returned a non-2xx status code".

### Ajuste na Edge Function `sync-prices`

1. **Novo mapeamento de header** (case-insensitive, aceita acento e espaço):
   - `procod` (mantém)
   - `preco 1` / `preço 1` / `tabela 1` → `price1Idx`
   - `preco 4` / `preço 4` / `tabela 4` / `protabpre` (fallback legado) → `price4Idx`
   - `preco 9` / `preço 9` / `tabela 9` → `price9Idx`
   - `descrição produto` / `descricao produto` / `des_pro` / `pronom` / `nome` → `nameIdx`
   - `grupo` / `des grp` / `desgrp` → `grpIdx`
   - `procodbar` / `ean` / `barras` → `barIdx`

2. **Validação**: exigir `procod` + pelo menos uma das colunas de preço (`price1Idx`, `price4Idx` ou `price9Idx`). Mensagem de erro passa a listar exatamente quais colunas foram lidas, para facilitar diagnóstico futuro.

3. **Parsing linha a linha**:
   - `p1 = parse(price1Idx)`, `p4 = parse(price4Idx)`, `p9 = parse(price9Idx)`.
   - Fallback: se alguma tabela vier vazia/0, usar o primeiro valor válido entre as três (garante retrocompatibilidade com planilhas antigas de tabela única).
   - Considerar linha válida quando pelo menos um preço > 0.

4. **Update de produtos existentes**: comparar e gravar `price_table_1`, `price_table_4`, `price_table_9`. Manter `base_price = p4` (fonte de verdade para storefronts não segmentados). Continuar registrando `priceUpdates` quando qualquer uma das três tabelas mudar (com detalhamento por tabela no retorno).

5. **Insert de produtos novos**: preencher `base_price = p4`, `price_table_1 = p1`, `price_table_4 = p4`, `price_table_9 = p9`.

6. **Categorias e consolidação**: lógica atual preservada (usa `GRUPO`).

### Fora de escopo
- UI do botão "Atualizar Preços" e demais telas não mudam.
- Nenhuma migration nova — colunas `price_table_*` já existem.

### Verificação
- Após a alteração, clicar em "Atualizar Preços" com o produto `7898418090477` deve gravar `price_table_1=13.90`, `price_table_4=25.00`, `price_table_9=14.90`, `base_price=25.00`.
- Toast deve mostrar contadores de preços atualizados sem 4xx/5xx.
