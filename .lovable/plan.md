

# Importacao Excel: Upsert por Codigo + Limpeza de Duplicados

## Problema

A loja Rafas tem 221 produtos, todos com codigos duplicados (RAF0001 a RAF0020+, cada um aparecendo 2x). A importacao atual sempre faz INSERT, criando duplicados ao reimportar.

## Solucao

### 1. Limpar duplicados existentes no banco

Executar uma migracao SQL que remove os duplicados, mantendo apenas o registro mais recente (por `created_at`) para cada combinacao `store_id + code`.

```sql
DELETE FROM products
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY store_id, code
      ORDER BY created_at DESC
    ) as rn
    FROM products
    WHERE code != ''
  ) sub
  WHERE rn > 1
);
```

### 2. Alterar logica de importacao para UPSERT

No `ImportProductsDialog.tsx`, modificar o `handleImport` para:

1. **Antes de importar**: buscar todos os produtos existentes da loja que tenham codigo preenchido
2. **Para cada linha da planilha com codigo**:
   - Se o codigo ja existe na loja: fazer UPDATE (nome, descricao, preco, categoria, status)
   - Se o codigo nao existe: fazer INSERT normalmente
3. **Linhas sem codigo**: sempre INSERT (comportamento atual)

A logica sera:
- Carregar mapa de `code -> product_id` existente
- Separar batch em "updates" e "inserts"
- Para updates: usar `.update()` individual ou em lote
- Para inserts: usar `.insert()` em lote como ja faz

### 3. Indicacao visual na pre-visualizacao

Adicionar uma coluna "Acao" na tabela de preview mostrando:
- "Atualizar" (icone de refresh) para linhas cujo codigo ja existe
- "Novo" (icone de plus) para linhas com codigo novo ou sem codigo

O resultado final mostrara: "X atualizado(s), Y novo(s), Z erro(s)"

---

## Arquivos a modificar

| Arquivo | Mudanca |
|---|---|
| Migracao SQL | Remover produtos duplicados existentes |
| `src/components/ImportProductsDialog.tsx` | Logica de upsert + indicacao visual de "Atualizar" vs "Novo" |

## Detalhes tecnicos

- O `ParsedRow` ganhara um campo `action: 'update' | 'insert'` preenchido apos carregar os produtos existentes
- O `handleImport` separara as linhas em dois grupos e processara updates e inserts separadamente
- Updates usarao chamadas individuais `.update().eq('id', existingId)` para cada produto
- O resultado exibira contagem separada de atualizados vs novos

