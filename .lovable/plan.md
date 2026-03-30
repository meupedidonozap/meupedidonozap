

# Adicionar Edição de Categorias para Todas as Lojas

## Problema

Atualmente, o painel admin de cada loja permite apenas **adicionar** e **excluir** categorias. Não há opção para **renomear** uma categoria existente.

## Solução

Adicionar um botão de edição (ícone de lápis) em cada card de categoria. Ao clicar, o nome da categoria se torna um campo editável inline. O hook `useUpdateCategory` já existe em `useCategories.ts` — só precisa ser usado no `StoreAdminPage.tsx`.

## Mudanças

### Arquivo: `src/pages/StoreAdminPage.tsx`

1. **Importar** `useUpdateCategory` (já existe no hook, só não está importado)
2. **Adicionar estados** para controlar edição inline: `editingCategoryId` e `editingCategoryName`
3. **Adicionar funções** `handleEditCategory` (abre edição) e `handleSaveCategory` (salva nome)
4. **Modificar o card de categoria** (linhas 533-546): adicionar modo de edição inline com Input + botão salvar, e botão de edição (Edit2) ao lado do botão de exclusão

### Comportamento

- Clicar no ícone de lápis → nome vira Input editável com botões Salvar/Cancelar
- Salvar chama `updateCategory.mutateAsync({ id, name })`
- Funciona para **todas as lojas** (LOJA, ACESSORIOS, COMIDA, SERVICOS) pois a aba Categorias já é compartilhada

