## Problema

Hoje a Pastelaria RM (loja tipo COMIDA) usa `FoodStorePage`, que mostra os itens agrupados em categorias collapsibles e em modo lista por padrão. O cliente quer o mesmo comportamento da DICOLORE (`ProductStorePage`):

- Abrir mostrando **todos os produtos** em **modo grade**, ordenados de **A–Z**, sem separação por categoria.
- Botão de **menu** (ícone hambúrguer no header) abre uma **gaveta lateral** com a lista de categorias ("Todos os Produtos" + cada categoria), permitindo filtrar.

## Solução

Refatorar `src/pages/FoodStorePage.tsx` para usar o mesmo modelo de navegação da `ProductStorePage`, mantendo a lógica específica de comida (assembly dialog, ingredientes, bordas, material de apoio não se aplica aqui).

### Mudanças em `src/pages/FoodStorePage.tsx`

1. **Estado**
   - Remover `expandedCategories` e `itemsByCategory` agrupado.
   - Adicionar `selectedCategory: string` (default `'all'`) e `isCategoryOpen: boolean`.
   - Trocar default do `viewMode` de `'list'` para `'grid'`.

2. **Header**
   - Adicionar botão `Menu` (ícone hambúrguer) à esquerda do nome da loja, abrindo `Sheet` lateral com:
     - Item "Todos os Produtos"
     - Lista das categorias da loja
     - Ao clicar, atualiza `selectedCategory` e fecha a gaveta.
   - Manter os botões de busca, alternância grade/lista, perfil/login e compartilhar.

3. **Listagem**
   - Substituir o loop `categories.map(...Collapsible...)` por uma única grade/lista:
     - Filtrar `activeProducts` por `searchTerm` **e** `selectedCategory` (`all` = todos).
     - Ordenar **A–Z** por `name` (`localeCompare('pt-BR')`).
   - Renderizar:
     - Em `viewMode === 'grid'`: grid responsiva (2/3/4 colunas) com card já existente.
     - Em `viewMode === 'list'`: grid 1/2 colunas com o card de linha já existente.
   - Manter card, preço, botão `+` e contador de quantidade exatamente como já estão (`handleAddItem`, `AssemblyDialog`, `getItemQuantity`).

4. **Mantém intacto**
   - Bottom nav (Início / Pedidos / Carrinho), FAB do carrinho, `CustomerAuthDialog`, `AssemblyDialog`, Helmet/SEO.
   - Comportamento de variantes e montagem (clicar `+` segue chamando `handleAddItem` que decide se abre `AssemblyDialog`).

### Fora de escopo

- Nenhuma mudança em `ProductStorePage`, schema, RLS ou Edge Functions.
- Nenhuma alteração em outras lojas COMIDA — todas passam a usar o novo layout (consistente com a memória do projeto: "A-Z catalog sorting" em todo o catálogo).

## Arquivo a alterar

- `src/pages/FoodStorePage.tsx` — refatoração do header + listagem conforme acima.
