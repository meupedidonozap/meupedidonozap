## Objetivo
Na aba **Pedidos** do painel administrativo, quando o cliente do pedido tiver um representante/vendedor vinculado, apresentar o **nome do vendedor** abaixo da linha do código do cliente.

## Mudanças

Arquivo único: `src/pages/StoreAdminPage.tsx` (aba "Pedidos", em torno da linha 1129).

### 1. Resolução do vendedor vinculado ao pedido
A página já possui os dados necessários em memória:

- `customerProfiles` → campo `sellerCode` (código do representante vinculado ao cliente).
- `sellers` / `sellerByCode` → Map de `code` → objeto do vendedor com `name`.
- `whatsappToSellerCode` → Map de últimos 8 dígitos do WhatsApp → `sellerCode`.

Criar uma função helper `resolveOrderSellerName(order)` que:

1. Pega o WhatsApp do pedido (`order.customer.whatsapp`).
2. Busca o `sellerCode` via `whatsappToSellerCode`.
3. Se houver código, busca o vendedor em `sellerByCode`.
4. Retorna o `name` do vendedor ou `null`.

### 2. Exibição na célula do cliente
Na célula "Cliente" da tabela de pedidos (linha ~1129), logo após a linha que exibe `Código: {code}`, adicionar condicionalmente:

```text
Vendedor: {sellerName}
```

- Exibir apenas quando `sellerName` existir.
- Usar `text-xs` e uma cor semântica do tema (ex: `text-muted-foreground` ou `text-destructive` conforme identidade visual) para manter a hierarquia visual.
- Manter o layout flex em coluna, como já está.

### 3. Fora de escopo
- Nenhuma mudança em backend, hooks, RLS, banco ou outras abas.
- Apenas exibição; não altera criação, edição, filtros ou exportação dos pedidos.
- A lógica de paginação e ordenação existente dos pedidos permanece inalterada.

## Validação
- Verificar visualmente no preview um pedido cujo cliente tenha representante vinculado (ex: Dicolore).
- Confirmar que o nome do vendedor aparece abaixo do código do cliente.
- Confirmar que pedidos sem representante não exibem a nova linha.