## Toggle Lista/Grade com fotos grandes em COMIDA e PIZZARIA

Adiciona o mesmo padrão da loja LOJA (Dicolore) nas lojas COMIDA e PIZZARIA: botão no header para alternar entre Lista (atual) e Grade, mantendo categorias e fluxos existentes intactos.

### `src/pages/FoodStorePage.tsx`
- Importar ícones `List` e `LayoutGrid` do `lucide-react`.
- Adicionar `useState<'list' | 'grid'>('list')`.
- No header, ao lado do botão de busca, botão único que alterna o modo (mostra `LayoutGrid` quando está em lista e `List` quando está em grade).
- Dentro de cada `CollapsibleContent` de categoria, renderizar condicionalmente:
  - **Lista (atual):** mantém o card horizontal exatamente como está.
  - **Grade:** `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3`, com foto grande em cima (`aspect-square object-contain bg-white`), nome (`line-clamp-2`), preço, e o mesmo botão `+` / contador `−/+` reaproveitando `handleAddItem`, `getItemQuantity` e `needsAssembly`.

### `src/pages/PizzaStorePage.tsx`
- Importar `LayoutGrid` e `List`.
- Adicionar `useState<'list' | 'grid'>('list')`.
- Botão de alternância no header ao lado do botão de busca (estilo escuro como os demais).
- A aba "Pizzas" e o `PizzaBuilderDialog` ficam intactos.
- Nas seções de `FoodItem` (linhas 425-441), quando `viewMode === 'grid'`, trocar a lista vertical de `MenuItemCard` por um grid `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` de cards quadrados com foto grande em cima e nome/preço/`+` abaixo (novo componente local `MenuItemGridCard`, mesmo tema dark/laranja).

### Notas técnicas
- Sem mudanças em backend, hooks, tipos, banco ou no fluxo de carrinho.
- Imagens seguem `object-contain bg-white` (regra do projeto).
- Default permanece `list` para não impactar quem já usa.
- Nenhuma alteração no que foi feito anteriormente (bairros/entrega, garçom, mesa).