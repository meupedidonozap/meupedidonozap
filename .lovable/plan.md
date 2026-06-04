## Ajustar Novo Pedido (Admin) para suportar variantes

### Problema
Na Pastelaria RM, os produtos da categoria "Pastel" têm variantes de tamanho (P/G) com preços distintos. Hoje, no diálogo "Novo Pedido" do painel admin, o botão **+ Adicionar** insere o produto direto pelo `basePrice`, ignorando as variantes — todos saem como "PASTEL BACON COM PALMITO R$ 15,00" sem distinção de tamanho, e o preço de "G" nunca é aplicado.

### Solução
Replicar no `NewOrderDialog` o mesmo comportamento da loja pública (storefront): quando o produto tem variantes, abrir um seletor de tamanho/cor antes de adicionar ao pedido. Cada combinação vira uma linha separada no carrinho do pedido.

### Mudanças

**`src/components/NewOrderDialog.tsx`**

1. Detectar variantes: `product.hasVariants && product.variants?.length > 0`.
2. Ao clicar em **+ Adicionar** num produto com variantes:
   - Abrir um pequeno dialog inline (estado local `variantPicker: { product, color?, size? }`) com botões P/G (tamanhos) e cores, igual ao `VariantDialog` do storefront, porém sem carrossel/imagens — apenas seletor compacto e botão "Adicionar".
   - Mostrar o preço da variante selecionada.
3. Ao confirmar, inserir item no `orderItems` com:
   - `productId`, `variantId`, `name`, `code` (sufixo `P` ou `G`), `size`, `color`, `price` = `variant.price`, `quantity: 1`.
   - Chave de identidade do item passa a ser `productId + variantId` (em vez de só `productId`) — ajustar `addProduct`, `updateQuantity`, `removeItem` e o `find` que detecta "já no carrinho" para usar essa chave composta.
4. Na lista de produtos:
   - Se `hasVariants`, mostrar "A partir de R$ X,XX" e o botão **+ Adicionar** sempre abre o seletor (mesmo que já exista no carrinho — permite adicionar outro tamanho).
   - Os controles +/− por linha continuam funcionando para produtos sem variante; para produtos com variante, removo os +/− inline (a quantidade é gerenciada no resumo "Itens selecionados").
5. No resumo "Itens selecionados", exibir o tamanho/cor ao lado do nome (ex.: "1x PASTEL BACON COM PALMITO — G").

### Fora do escopo
- Não muda o fluxo da loja pública nem o `VariantDialog`.
- Não muda salvamento do pedido (`useCreateOrder` já persiste `variantId`, `size`, `color`).
- Não mexe em trigger/cache/erros de pedido (já tratados nos turnos anteriores).
