
## Correção do delay na edição da OS

### Diagnóstico
O problema é de sincronização de estado/cache, não de cálculo:
- `ServiceOrderDialog` abre com `selectedSO` salvo no estado do `StoreAdminPage`
- ao salvar, os hooks apenas fazem `invalidateQueries`, então a tela espera o refetch
- nesse intervalo, `selectedSO` continua com os dados antigos
- por isso, ao abrir a OS novamente logo em seguida, ainda aparece o valor antigo; só na segunda entrada, depois do refetch, aparece correto

## O que vou ajustar

### 1. Parar de depender de objeto “congelado” em `selectedSO`
Arquivo: `src/pages/StoreAdminPage.tsx`

Trocar o fluxo para que a OS aberta sempre use a versão mais atual:
- guardar `selectedSOId` em vez de guardar o objeto inteiro, ou
- recalcular `selectedSO` a partir de `serviceOrders` pelo `id`

Assim, quando a lista de OS atualizar, o dialog passa a receber automaticamente o registro novo.

### 2. Corrigir a inicialização do `ServiceOrderDialog`
Arquivo: `src/components/ServiceOrderDialog.tsx`

Remover o padrão atual:
```ts
if (serviceOrder && !initialized) { ... }
```

E substituir por sincronização reativa baseada em:
- `serviceOrder?.id`
- `serviceOrder?.updatedAt`
- `open`

Isso evita:
- abrir com dados antigos
- manter estado interno desatualizado
- precisar fechar/abrir duas vezes para refletir a edição

### 3. Atualizar cache imediatamente após salvar
Arquivos:
- `src/hooks/useServiceOrders.ts`
- `src/hooks/useOrders.ts`

Em vez de só invalidar, aplicar atualização imediata no React Query:
- atualizar a OS editada dentro de `['service-orders', storeId]`
- atualizar o pedido relacionado dentro de `['orders', storeId]`

Resultado:
- total do pedido muda na hora na aba de pedidos
- OS reabre já com extras/valores corretos
- a interface não depende de um segundo acesso para mostrar o dado salvo

### 4. Fazer o save retornar e propagar os dados já atualizados
Arquivos:
- `src/components/ServiceOrderDialog.tsx`
- `src/pages/StoreAdminPage.tsx`

No salvar:
- usar o retorno de `updateSO.mutateAsync(...)`
- usar o retorno de `updateOrder.mutateAsync(...)`
- atualizar o estado do admin com o resultado salvo imediatamente

Assim, “Abrir OS” pela tela de pedidos e abrir pela tela de OS passam a usar exatamente a mesma fonte atualizada.

### 5. Garantir sincronização bidirecional entre Pedido e OS
Arquivo: `src/pages/StoreAdminPage.tsx`

Quando salvar a OS:
- atualizar subtotal/total/status do pedido imediatamente
- manter a OS aberta/fechada com os dados novos já refletidos
- garantir que o botão “Abrir OS” sempre pegue a OS atual do array `serviceOrders`, nunca uma referência antiga

## Resultado esperado
Depois da correção:
- salvar a OS atualiza o valor do pedido imediatamente
- reabrir a OS mostra os itens e totais corretos já na primeira vez
- não será mais necessário entrar “pela segunda vez”
- a aba Pedidos e a aba Ordens de Serviço ficam sincronizadas em tempo real no frontend

## Detalhe técnico
A causa principal é a combinação de:
- estado local guardando objeto antigo (`selectedSO`)
- inicialização imperativa dentro da renderização
- invalidação sem atualização otimista/imediata do cache

A correção ideal é:
```text
Salvar OS
  -> receber OS atualizada
  -> atualizar cache de service-orders
  -> atualizar pedido vinculado no cache de orders
  -> dialog consumir sempre a OS atual por id
```
