## Causa do problema

O pedido #238 (GEOVANE RENATO MICHELLI, 47 99255-0199) foi feito com **RETIRAR NA LOJA**. No checkout (`src/pages/CheckoutPage.tsx`, linha 315) o upsert do perfil do cliente está condicionado a entrega:

```ts
if (!isPickup) await upsertProfile.mutateAsync({ ... });
```

Ou seja, quando o cliente escolhe retirada, o pedido é gravado normalmente (com `user_id`), mas o perfil **nunca** é criado em `customer_profiles` — por isso ele não aparece na aba **Clientes** do painel. Conferi no banco: existe o `user_id` no pedido, mas nenhum registro em `customer_profiles` para esse usuário/whatsapp.

## Correção

**1. `src/pages/CheckoutPage.tsx`** — remover o `if (!isPickup)` e **sempre** chamar `upsertProfile.mutateAsync(...)`, passando strings vazias para os campos de endereço quando for retirada (nome, whatsapp e CPF/CNPJ continuam sendo salvos). Isso garante que todo cliente que finaliza um pedido fique cadastrado na lista.

**2. Backfill do GEOVANE (pedido #238)** — criar um registro em `customer_profiles` para o `user_id` do pedido, copiando nome e whatsapp do JSON `customer` do próprio pedido. Faço via migration de INSERT idempotente (só insere se não existir perfil para aquele `user_id` + `store_id`). Como medida geral, a mesma migration roda um INSERT…SELECT para qualquer outro pedido órfão da Pastelaria RM que tenha `user_id` mas sem perfil correspondente.

## Fora do escopo

- Não mexo no fluxo de variantes do Novo Pedido (já entregue no turno anterior).
- Não mexo em RLS, triggers de `order_number`, cache/SW, nem na lógica de pedidos via Mesa/Admin (esses já gravam clientes pelo próprio fluxo de Mesa).
