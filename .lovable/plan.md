

# Auto-gerar Codigo Alfanumerico do Produto (ultimo prefixo + 1)

## Logica

Quando o campo "Codigo" ficar vazio ao criar um produto, o sistema busca o ultimo codigo cadastrado na loja, extrai o prefixo alfabetico e o numero sequencial, e gera o proximo. Exemplo: se o ultimo for `RAF0121`, gera `RAF0122` mantendo os zeros a esquerda.

## Mudanca

### Arquivo: `src/hooks/useProducts.ts`

Adicionar funcao auxiliar `getNextProductCode(storeId)`:

1. Buscar todos os `code` de `products` filtrados por `store_id`, ordenados por `created_at desc`
2. Encontrar o ultimo codigo nao-vazio
3. Separar prefixo alfanumerico (ex: `RAF`) do sufixo numerico (ex: `0121`) usando regex `/^([A-Za-z]*)(\d+)$/`
4. Incrementar o numero e formatar com `padStart` para manter o mesmo numero de digitos
5. Retornar `prefixo + numeroFormatado` (ex: `RAF0122`)
6. Se nenhum codigo existir, retornar `"1"`

Alterar `useCreateProduct`: se `product.code` estiver vazio, chamar `getNextProductCode(product.storeId)` antes do insert.

### Arquivo: `src/components/ImportProductsDialog.tsx`

Verificar se produtos importados sem codigo tambem precisam da mesma logica e aplicar se necessario.

### Nenhuma mudanca no formulario

O campo "Codigo" em `ProductFormDialog.tsx` ja aceita valor vazio. O placeholder pode ser atualizado para indicar que sera gerado automaticamente (ex: "Auto").

