

# Corrigir sincronização de preços e adicionar atualização de categorias

## Problemas identificados

1. **Bug no parser CSV**: O código usa `split(",")` simples, que quebra valores entre aspas como `"94,9"`. O Google Sheets exporta preços com vírgula decimal entre aspas (ex: `"94,9"`, `"326,7"`). O split trata a vírgula do preço como separador de coluna, resultando em preço inválido → produto ignorado.

2. **Planilha sem coluna "Des GRP"**: A planilha publicada atualmente só tem 3 colunas: `procod`, `protabcod`, `protabpre`. Para sincronizar categorias, o usuário precisa adicionar a coluna `Des GRP` na planilha.

3. **Contagem correta**: A planilha tem ~3750 linhas, mas ~597 com preço > 0 (ativos). O banco tem 354 produtos. A diferença entre 288 e 597 provavelmente vem do bug de parsing que descartava itens com preços entre aspas.

## Solução

### 1. Reescrever o parser CSV na Edge Function `sync-prices`

Substituir `split(",")` por um parser que respeita campos entre aspas (RFC 4180). Isso garante que `"94,9"` seja lido como `94.9` corretamente.

### 2. Adicionar sincronização de categorias

- Buscar a coluna `Des GRP` (ou `des grp`) do CSV
- Para cada produto na planilha, verificar se o `Des GRP` corresponde a uma categoria existente na loja
- Se o produto no banco estiver em categoria diferente, atualizar o `category_id`
- Se a categoria do `Des GRP` não existir no banco, criar automaticamente

### 3. Melhorar o resumo retornado

Retornar contagens separadas: preços atualizados, categorias atualizadas, categorias criadas.

### 4. Atualizar o toast no admin

Mostrar resumo completo: preços + categorias atualizados.

## Requisito do usuário

**A coluna `Des GRP` precisa ser adicionada na planilha do Google Sheets.** Atualmente só existem `procod`, `protabcod`, `protabpre`. Sem essa coluna, a sincronização de categorias não funcionará.

## Detalhes técnicos

### Parser CSV correto (trecho)
```text
Entrada:  KIT024,4,"94,9"
Split simples: ["KIT024", "4", "\"94", "9\""]  ← ERRADO
Parser RFC:    ["KIT024", "4", "94,9"]          ← CORRETO
```

### Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/sync-prices/index.ts` | Reescrever parser CSV + adicionar sync de categorias |
| `src/pages/StoreAdminPage.tsx` | Atualizar toast com resumo de categorias |

