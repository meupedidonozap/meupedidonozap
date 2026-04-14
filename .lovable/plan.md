

# Atualizar Precos via Planilha Google Sheets

## Contexto

A planilha publica tem 3 colunas:
- `procod` = codigo do produto (ex: `DV5938032`, `KIT024`)
- `protabcod` = codigo da tabela (sempre `4`)
- `protabpre` = preco (formato BR com virgula, ex: `94,9`, `326,7`, ou `0` para sem preco)

Os produtos no banco tem um campo `code` que corresponde ao `procod` da planilha, e `base_price` que deve ser atualizado com `protabpre`.

## Plano

### 1. Criar Edge Function `sync-prices`

Uma Edge Function que:
- Faz fetch da planilha CSV publica do Google Sheets
- Parseia o CSV extraindo `procod` e `protabpre`
- Ignora linhas com preco 0
- Busca todos os produtos da loja no banco
- Compara `code` do produto com `procod` da planilha
- Atualiza `base_price` dos produtos que tem preco diferente
- Retorna um resumo: quantos atualizados, quais codigos, precos antigos vs novos

Endpoint: `POST /sync-prices` com body `{ "store_id": "uuid" }`

### 2. Adicionar botao "Atualizar Precos" no painel admin

Na aba de Produtos do `StoreAdminPage.tsx`:
- Botao "Atualizar Precos" ao lado do botao de importar
- Ao clicar, chama a Edge Function `sync-prices`
- Mostra loading enquanto processa
- Exibe toast com resumo (ex: "12 precos atualizados")
- Recarrega a lista de produtos apos a atualizacao

### 3. URL da planilha

A URL do CSV sera hardcoded na Edge Function por enquanto (pode ser movida para settings da loja futuramente):
```
https://docs.google.com/spreadsheets/d/e/2PACX-1vTiEn32ibtrbsQQf4UAjNo3gJk13p7g4olYSWl2IRSNvkowpT1etqnS887s-mEAF2vrEAXnGMY96OKD/pub?output=csv
```

## Detalhes tecnicos

- A Edge Function usa `SUPABASE_SERVICE_ROLE_KEY` para bypass de RLS ao atualizar precos
- Precos no formato BR (virgula) sao convertidos para numero (`"94,9"` -> `94.9`)
- Apenas produtos com `store_id` correspondente sao afetados
- Produtos com preco 0 na planilha sao ignorados (nao zera o preco)
- Nenhuma migracao de banco necessaria

## Arquivos

| Arquivo | Acao |
|---------|------|
| `supabase/functions/sync-prices/index.ts` | Criar |
| `src/pages/StoreAdminPage.tsx` | Adicionar botao na aba Produtos |

