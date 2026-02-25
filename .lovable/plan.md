

# Correcao de 4 Problemas em Lojas do Tipo SERVICOS

## Problema 1: Valores duplicando ao abrir/fechar OS

### Causa Raiz

No `ServiceOrderDialog.tsx`, ao salvar (linha 131):

```typescript
const mergedItems = [...serviceOrder.items, ...extrasAsCartItems];
```

Os extras sao convertidos em CartItem e concatenados aos items originais. Na proxima abertura, `serviceOrder.items` ja contem esses extras (pois foram salvos assim), e `serviceOrder.extraItems` tambem os lista separadamente. Ao salvar novamente, os extras sao adicionados de novo, duplicando os valores.

### Solucao

Parar de fazer merge dos extras em `items`. Salvar os items originais intactos e manter os extras apenas em `extra_items`. O calculo do total ja considera ambos separadamente.

**Arquivo:** `src/components/ServiceOrderDialog.tsx`

Remover as linhas 123-131 (merge de extras em items) e salvar apenas os items originais:

```typescript
await updateSO.mutateAsync({
  id: serviceOrder.id,
  storeId: serviceOrder.storeId,
  // Nao altera items originais - extras ficam em extraItems
  extraItems,
  subtotal: itemsTotal + extrasTotal,
  total: grandTotal,
  status,
  observations,
});
```

---

## Problema 2: Nao e possivel excluir itens avulsos

### Causa Raiz

O botao de excluir extra items existe (linha 268), mas a imagem enviada pelo usuario mostra que os itens aparecem na secao "Servicos do Pedido" (items originais) e nao na secao "Materiais Adicionais" — justamente por causa do bug #1 que mescla extras nos items. Como items originais nao tem botao de exclusao, o usuario nao consegue remover.

### Solucao

Corrigido automaticamente pelo fix do problema #1: extras permanecerao na secao correta com botao de exclusao. Nao e necessaria mudanca adicional — o `handleRemoveExtra` ja funciona corretamente.

---

## Problema 3: Novo status "PAGO" com data de pagamento para o dashboard

### Mudancas necessarias

**3a. Migracao de banco de dados:**
- Adicionar coluna `paid_at` (timestamp, nullable) na tabela `service_orders`

**3b. Tipo TypeScript** (`src/types/index.ts`):
- Adicionar `'pago'` ao tipo `ServiceOrderStatus`
- Adicionar `paidAt?: string` ao tipo `ServiceOrder`

**3c. Hook** (`src/hooks/useServiceOrders.ts`):
- Mapear `paid_at` para `paidAt`
- Aceitar `paidAt` no update

**3d. Dialogo da OS** (`src/components/ServiceOrderDialog.tsx`):
- Adicionar status "Pago" nos labels e cores
- Quando status mudar para "pago", gravar `paid_at = now()`
- Adicionar campo de data de pagamento (input date) que aparece quando status = "pago"
- Quando OS for marcada como "pago", sincronizar pedido como "entregue"

**3e. Dashboard** (`src/pages/StoreAdminPage.tsx`):
- Alterar calculo de faturamento: em vez de apenas pedidos com status "entregue", tambem considerar as OS com status "pago" e usar `paid_at` como data de referencia para o filtro de periodo
- Isso garante que o faturamento seja contabilizado no mes do pagamento, nao no mes de criacao da OS

### Fluxo proposto

```text
OS criada (aberta) --> em_andamento --> concluida --> pago (com data)
                                                       |
                                                       v
                                              Dashboard conta como faturamento
                                              usando a data de pagamento
```

---

## Problema 4 (implicito): Controle de edicao da OS apos entrega

O usuario mencionou que apos "ENTREGUE" nao se pode mais abrir a OS. Somente revertendo o pedido para "PREPARANDO" se pode editar novamente.

### Solucao

No `ServiceOrderDialog.tsx`:
- Quando status da OS for "pago", desabilitar todos os campos de edicao (extras, status, observacoes)
- Exibir mensagem informativa: "OS paga. Para editar, reabra o pedido."
- Manter o botao de WhatsApp ativo para consulta

No `StoreAdminPage.tsx`:
- Quando o status do pedido for "entregue", nao mostrar o botao "Abrir OS" (ou mostrar como somente leitura)

---

## Resumo de Arquivos Alterados

| Arquivo | Mudanca |
|---|---|
| Migracao SQL | Adicionar coluna `paid_at` em `service_orders` |
| `src/types/index.ts` | Adicionar `'pago'` ao ServiceOrderStatus e `paidAt` ao ServiceOrder |
| `src/hooks/useServiceOrders.ts` | Mapear `paid_at`, aceitar no update |
| `src/components/ServiceOrderDialog.tsx` | Fix merge duplicado, adicionar status pago com data, bloquear edicao quando pago |
| `src/pages/StoreAdminPage.tsx` | Dashboard: calcular faturamento considerando OS pagas por `paid_at` |

