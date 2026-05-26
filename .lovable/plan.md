## Problema

No celular o diálogo "Mesa X — Comandas" (TableSessionDialog) aparece cortado: a barra de ações (Comanda, Novo pedido, Avulso, Conferência, Pagar) usa `flex` sem wrap e empurra o conteúdo para fora da tela, obrigando rolagem horizontal. O `PaymentDialog` tem o mesmo problema.

## Mudanças (somente UI/responsividade — sem alterar lógica)

### `src/components/TableSessionDialog.tsx`

1. **DialogContent principal**
   - De: `max-h-[90vh] max-w-4xl overflow-y-auto`
   - Para: `max-w-[100vw] sm:max-w-4xl w-screen sm:w-full h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto p-3 sm:p-6 rounded-none sm:rounded-lg`
   - Em mobile ocupa a tela inteira; em desktop mantém o comportamento atual.

2. **Header de ações (linha com Total + botões)**
   - Trocar `flex items-center justify-between gap-2` por `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2`
   - Na div dos botões: `flex flex-wrap gap-2` para quebrar linha em telas pequenas
   - Reduzir labels longos em mobile usando `hidden sm:inline` nos textos (manter ícone visível): ex. "Novo pedido (cardápio)" → ícone + "Cardápio" curto no mobile

3. **TabsList das comandas**
   - Já tem `flex-wrap`, manter. Garantir `overflow-x-auto` como fallback.

4. **Cards de itens**
   - O `Card` interno: trocar `flex items-center justify-between p-2` por `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2` para que preço + lixeira fiquem abaixo do nome em telas estreitas.

5. **PaymentDialog**
   - DialogContent: aplicar mesmo padrão responsivo (`max-w-[100vw] sm:max-w-2xl h-[100dvh] sm:h-auto`, padding reduzido).
   - DialogFooter já é responsivo via componente base.

### Nenhuma outra alteração

- Sem mudanças em hooks, lógica de pagamento, banco de dados ou outros componentes.
- Sem mudar `dialog.tsx` base (afetaria todo o app).

## Arquivos editados

- `src/components/TableSessionDialog.tsx`
