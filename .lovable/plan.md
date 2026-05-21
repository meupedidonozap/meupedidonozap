## Objetivo

Criar regra "Material de Apoio": uma ou mais categorias podem ter, somadas, no máximo X% do valor das **demais categorias** do pedido. Ao tentar ultrapassar, bloquear a adição/aumento de quantidade com a mensagem **"MATERIAL DE APOIO PASSA DA REGRA DE BONIFICAÇÃO"**. Desta forma, volta para o produto que estava sendo adicionado para DIMINUIR ou EXCLUIR do carrinho e poder recalcular e seguir com o processo de compra.

## Cálculo (validado pelos exemplos)

`maxMaterial = (subtotal de itens fora das categorias de apoio) × (percent / 100)`

Exemplo (percent = 4%, outras = R$ 1.000):

- limite = 40,00
- 20,00 → ok (acumulado 20)
- +11,90 → ok (acumulado 31,90)
- +9,20 → bloqueia (acumulado 41,10 > 40,00) → mostra toast.

Se o usuário alterar o % na configuração, o cálculo respeita o novo valor automaticamente em todos os pontos.

## Mudanças

### 1. Tipo e configuração (`src/types/index.ts`)

Adicionar em `StoreSettings`:

```ts
materialApoio?: {
  enabled: boolean;
  maxPercent: number;       // ex: 4
  categoryIds: string[];    // categorias consideradas "material de apoio"
};
```

### 2. UI de configuração (`StoreAdminPage.tsx`, aba **Configurações**)

Novo bloco "Regra de Material de Apoio":

- Switch **Ativar**
- Input numérico **% máximo do pedido** (default 4)
- Multi-seleção de **categorias** (lista de `categories` da loja)
- Salvar em `store.settings.materialApoio` via `useUpdateStore`.

### 3. Função utilitária reutilizável

Novo `src/lib/materialApoio.ts`:

```ts
checkMaterialApoio(items, products, settings):
  { allowed: boolean; max: number; current: number; message?: string }
```

Resolve `categoryId` por `productId` (consultando `products`) e devolve se o estado atual do carrinho está dentro do limite. Função auxiliar `wouldExceed(items, candidateAdditionValue, ...)` para checar antes de adicionar.

### 4. Bloqueio no storefront

`src/pages/ProductStorePage.tsx` → `handleAddToCart`:

- Antes de `addItem`, chamar `wouldExceed` simulando o novo subtotal do item. Se exceder, `toast.error('MATERIAL DE APOIO PASSA DA REGRA DE BONIFICAÇÃO')` e abortar.

`src/contexts/CartContext.tsx` → `updateQuantity` / `addItem`:

- Receber via novo método `setMaterialApoioConfig(...)` (ou ler do `discountRules`-style state) e validar antes de aplicar aumento de quantidade. Em caso de bloqueio, não atualiza e dispara callback/toast (manter toast no chamador para evitar acoplamento — expor `canAddOrIncrease(item, deltaValue)` no contexto e o chamador exibe mensagem).
- Alternativa mais simples: validar nos pontos de chamada (`ProductStorePage` botões + / quantity input), sem mudar a API do contexto. **Adotar esta para reduzir blast radius.**

### 5. Bloqueio no admin

`src/components/EditOrderDialog.tsx`:

- Receber prop `materialApoio` e `products`.
- Em `addProduct` e `updateQty(+1)` validar via `wouldExceed`. Se exceder, `toast.error` com a mensagem e não aplica.

`src/components/NewOrderDialog.tsx` (criação manual de pedido):

- Mesma validação ao adicionar/aumentar item.

`src/pages/StoreAdminPage.tsx`:

- Passar `materialApoio={store?.settings.materialApoio}` e `products` para `EditOrderDialog` e `NewOrderDialog`.

### 6. Mensagem padrão

Centralizar em `materialApoio.ts`:

```ts
export const MATERIAL_APOIO_MSG = 'MATERIAL DE APOIO PASSA DA REGRA DE BONIFICAÇÃO';
```

## Fora do escopo

- Não recalcula nem afeta cupons ou descontos por grupo.
- Não bloqueia pedido já existente que esteja acima do limite (apenas novas adições/incrementos).
- Não cria coluna no banco — fica todo dentro do JSONB `stores.settings`.

## Arquivos afetados

- `src/types/index.ts` (novo campo em `StoreSettings`)
- `src/lib/materialApoio.ts` (novo)
- `src/pages/StoreAdminPage.tsx` (UI config + passar props)
- `src/pages/ProductStorePage.tsx` (validação no add/qty)
- `src/components/EditOrderDialog.tsx` (validação no add/qty)
- `src/components/NewOrderDialog.tsx` (validação no add/qty)