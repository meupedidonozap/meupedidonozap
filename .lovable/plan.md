

# Destacar botão "Reabrir para Edição"

## Mudança

**Arquivo:** `src/components/ServiceOrderDialog.tsx` (linha 219-228)

Trocar o botão de `variant="outline"` para um estilo com cor de destaque — usar `className` com fundo verde (`bg-green-600 hover:bg-green-700 text-white`) para chamar atenção do usuario, similar ao destaque vermelho mostrado na screenshot.

O banner de aviso também será ajustado para ter borda colorida (`border-amber-300 bg-amber-50`) para reforçar que a OS está bloqueada e a ação de reabrir é importante.

