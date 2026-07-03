## Objetivo
Adicionar filtros de pesquisa na aba **Produtos** do painel administrativo da loja, permitindo localizar rapidamente itens por código, nome ou categoria.

## Mudanças

Arquivo único: `src/pages/StoreAdminPage.tsx` (aba "Produtos", em torno da linha 915).

### 1. Barra de filtros acima da tabela
Adicionar uma linha com 3 campos, logo abaixo do título "Produtos":

- **Buscar por código** — `Input` de texto, busca parcial (contém) no campo `product.code`.
- **Buscar por produto** — `Input` de texto, busca parcial (contém) em `product.name` (case-insensitive).
- **Filtrar por categoria** — `Select` com opção "Todas" + lista das categorias da loja; filtra por `product.categoryId`.

Botão "Limpar filtros" ao lado, visível apenas quando algum filtro estiver ativo.

### 2. Estado e lógica
- 3 novos `useState`: `filterCode`, `filterName`, `filterCategoryId` (default `'all'`).
- `filteredProducts = useMemo(...)` aplicando os três filtros sobre `products`.
- A `TableBody` passa a iterar `filteredProducts` em vez de `products`.
- Mensagem vazia adaptada: "Nenhum produto encontrado" quando há filtro ativo; "Nenhum produto cadastrado" caso contrário.

### 3. Layout responsivo
Filtros em `flex flex-wrap gap-2` para funcionar bem em desktop e mobile, sem alterar demais abas.

## Fora de escopo
- Nenhuma mudança em hooks, backend, RLS ou outras telas.
- A ordenação A-Z existente é mantida.
