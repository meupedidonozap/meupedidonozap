

# Correcao: Itens extras da OS devem ser incluidos no pedido

## Problema Identificado

Ao salvar a OS, os itens adicionais sao gravados apenas no campo `extra_items` separado, mas o usuario espera que eles sejam **incluidos no campo `items`** (itens do pedido) e o valor total seja atualizado. Alem disso, possiveis erros do banco estao sendo engolidos pelo `catch` generico, dificultando o diagnostico.

## Solucao

### 1. Alterar `ServiceOrderDialog.tsx` - Funcao `handleSave`

Ao salvar, os itens extras serao **mesclados no array `items`** da OS (convertendo `ServiceOrderExtraItem` para `CartItem`), e o total sera recalculado incluindo todos os itens. O campo `extra_items` tambem sera atualizado para manter registro.

Mudancas:
- Na funcao `handleSave`, construir um novo array `items` que combina os itens originais com os extras adicionados
- Passar o campo `items` atualizado para o `useUpdateServiceOrder`
- Melhorar o tratamento de erro para exibir a mensagem real do banco

### 2. Alterar `useServiceOrders.ts` - Funcao `useUpdateServiceOrder`

Adicionar suporte ao campo `items` no update, que atualmente nao esta incluido nos parametros aceitos.

Mudancas:
- Adicionar `items?: CartItem[]` aos parametros do mutation
- Mapear `params.items` para `update.items` no objeto de update

### 3. Melhorar feedback de erros

O `catch` atual engole o erro real. Alterar para exibir `error.message` no toast, facilitando o diagnostico de problemas de permissao (RLS) ou outros.

---

## Arquivos a modificar

| Arquivo | Mudanca |
|---|---|
| `src/hooks/useServiceOrders.ts` | Adicionar campo `items` nos parametros e no objeto de update |
| `src/components/ServiceOrderDialog.tsx` | Mesclar extras nos items ao salvar + melhorar tratamento de erro |

## Detalhes tecnicos

No `handleSave`, os extras serao convertidos de `ServiceOrderExtraItem` para `CartItem`:

```
{
  productId: item.id,
  name: item.name,
  code: item.description || '',
  price: item.price,
  quantity: item.quantity,
}
```

O array final de `items` sera: `[...serviceOrder.items, ...extrasConvertidos]`

Isso garante que ao reabrir a OS, todos os itens (originais + adicionados) aparecam juntos na lista principal, e o total reflita o valor correto.

