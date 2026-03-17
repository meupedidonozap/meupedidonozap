

# Corrigir exibição de produtos no Novo Pedido (Admin)

## Problema

Na tela de "Novo Pedido" do painel admin, os produtos não aparecem imediatamente na etapa de itens. Só aparecem depois de trocar a categoria no dropdown. Isso indica um problema de renderização do `ScrollArea` com altura fixa que não atualiza o conteúdo corretamente no mount inicial.

## Correções

### 1. Corrigir bug de renderização dos produtos (`NewOrderDialog.tsx`)

- Remover o `ScrollArea` com altura fixa `h-[200px]` e usar um `div` com `max-h` e `overflow-y-auto` — isso evita o problema de virtualização do ScrollArea que não renderiza items no mount
- Garantir que todos os produtos aparecem imediatamente com botão "+" visível, igual à experiência da vitrine do cliente
- Manter busca e filtro por categoria funcionando inline sem necessidade de trocar categoria primeiro

### 2. Corrigir build error na edge function (`google-product-feed/index.ts`)

- Tipar o `error` como `Error` no catch block (linha 123): `catch (error: unknown)` → usar `(error instanceof Error ? error.message : 'Unknown error')`

### Resultado esperado

Ao abrir "Novo Pedido" e ir para a etapa de itens, todos os produtos ativos aparecem listados com botão "+" para adicionar, busca filtra em tempo real, e trocar categoria é opcional — comportamento idêntico à vitrine do cliente.

