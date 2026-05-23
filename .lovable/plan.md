
# Plano — Fase 1: Montagem de Produtos para lojas COMIDA

Mesas/Comandas/Garçom = Fase 2 (plano separado depois desta entrega).

## 1. Visão geral

Hoje COMIDA usa `food_items` (sem variantes, sem grupos, sem ingredientes). Vamos:

- Migrar COMIDA para a tabela `products` (que já tem variantes, imagens, código).
- Criar um cadastro de **Ingredientes** por loja, com vínculo a categorias permitidas.
- Cada produto ganha um modo de montagem: **fixo** (bebida), **opcional/remover** (lanche), **escolher N** (pastel/pizza/borda).
- Pizza ganha um cadastro próprio de **Bordas recheadas**.
- Carrinho passa a aceitar item com ingredientes + observação por item.
- Impressão (térmica e A4) mostra ingredientes escolhidos / removidos / borda + observação.

## 2. Modelo de dados (migration)

Tabelas novas:

- `ingredients` — cadastro por loja
  - `store_id`, `name`, `extra_price` (numeric, default 0), `is_active`, `sort_order`
- `ingredient_categories` — N:N ingrediente ↔ categoria permitida
  - `ingredient_id`, `category_id`
- `pizza_borders` — cadastro de bordas por loja
  - `store_id`, `name`, `price`, `is_active`, `sort_order`
- `product_assembly` — configuração de montagem por produto
  - `product_id` (PK), `mode` ('fixed' | 'remove' | 'choose'), `allow_observation` (bool)
  - `limits_by_variant` (jsonb) — `{ variantId|'default': maxIngredients }`
  - `default_ingredient_ids` (uuid[]) — para lanche (marcáveis para remover)
  - `allow_border` (bool) — só pizza

RLS: padrão `is_store_admin OR is_platform_admin` para escrita; leitura pública (igual demais tabelas de catálogo).

## 3. Migração de dados COMIDA

Script de migration que para cada linha de `food_items`:
- cria um registro em `products` com `store_id`, `name`, `description`, `category_id`, `base_price`, `image_url`, `is_active`, `has_variants=false`;
- gera `code` sequencial seguindo o padrão atual;
- mantém `food_items` por compatibilidade até confirmarmos remoção (passo no fim da Fase 1).

`useFoodItems` e `FoodStorePage` passam a ler de `products` (via `useProducts`). `food_items` será removida ao final da fase.

## 4. UI Admin

**Nova aba "Ingredientes"** em `StoreAdminPage` para lojas COMIDA:
- lista, criar/editar/remover ingrediente, preço extra opcional, multi-select de categorias permitidas.

**Nova aba "Bordas"** em `StoreAdminPage` para COMIDA (quando houver categoria PIZZA):
- nome, preço, ativo.

**`ProductFormDialog` ganha seção "Montagem"** (só COMIDA):
- Modo: Fixo / Permite remover / Escolher ingredientes.
- Se "Escolher": para cada variante (P/M/G) define quantidade máxima de ingredientes. Lista dos ingredientes permitidos pela categoria fica visível.
- Se "Permite remover" (lanche): multi-select dos ingredientes que vêm marcados por padrão.
- Toggle "Permite borda recheada" (pizza).
- Toggle "Mostrar campo observação no item".

## 5. UI Storefront (FoodStorePage)

Botão "+" do produto que tem `mode != 'fixed'` abre **AssemblyDialog**:
- **Pastel** (mode='choose', sem variante): lista ingredientes permitidos, limite único.
- **Pastel/Pizza com variante**: seleção de tamanho primeiro → limite atualiza dinamicamente conforme `limits_by_variant`.
- **Pizza**: seleção de sabores (ingredientes da categoria PIZZA) + seleção opcional de Borda (lista `pizza_borders`).
- **Lanche** (mode='remove'): lista ingredientes pré-marcados; desmarcar gera "SEM X" na observação automaticamente.
- Campo livre de observação quando `allow_observation=true`.
- Preço do item = `base_price` (ou variante) + soma dos `extra_price` dos ingredientes escolhidos + preço da borda.

`CartItem` ganha campos opcionais:
- `ingredients?: { id, name, extraPrice }[]`
- `removedIngredients?: string[]`
- `border?: { id, name, price }`
- `observation?: string`

Dois itens iguais só agrupam se ingredientes/borda/obs forem idênticos.

## 6. Impressão e WhatsApp

`printOrder.ts` e `exportOrder.ts` passam a renderizar, por item:
```
1x Pizza M - Calabresa, Mussarela
   Borda: Catupiry
   Obs: sem cebola
```
Lanche com remoção:
```
1x X-Tudo
   SEM ervilha, SEM tomate
```

Térmica e A4 ambos.

## 7. Detalhes técnicos

- Novos hooks: `useIngredients`, `usePizzaBorders`, `useProductAssembly` (com mutações).
- `useFoodItems` deprecado: substituído por `useProducts(storeId)` filtrando por categoria.
- `mode='fixed'` é o default (mantém comportamento atual de bebidas).
- Realtime da cozinha continua igual; payload do item já leva ingredientes/obs.
- `materialApoio` e descontos por grupo continuam funcionando — ingredientes não disparam regras de grupo (são adicionais do item).

## 8. Fora do escopo desta fase

- Mesas, comandas, modo garçom, pagamento parcial → plano separado depois.
- Tela de cozinha continua como está (só recebe o item com observação enriquecida).

## Arquivos afetados

- Migration nova (tabelas + dados de `food_items`→`products`).
- `src/types/index.ts` (Ingredient, PizzaBorder, ProductAssembly, CartItem extras).
- `src/hooks/useIngredients.ts`, `usePizzaBorders.ts`, `useProductAssembly.ts` (novos).
- `src/hooks/useFoodItems.ts` (remover ao final).
- `src/components/ProductFormDialog.tsx` (seção Montagem).
- `src/components/AssemblyDialog.tsx` (novo).
- `src/pages/FoodStorePage.tsx` (usa products + abre AssemblyDialog).
- `src/pages/StoreAdminPage.tsx` (abas Ingredientes/Bordas).
- `src/lib/printOrder.ts`, `src/lib/exportOrder.ts` (render de ingredientes/borda/obs).
- `src/contexts/CartContext.tsx` (chave de agrupamento considera ingredientes).
