# Perguntas ao finalizar a edição do pedido (DiColore, modo vendedor/televendas)

Vale só para a DiColore, quando o vendedor ou o televendas está **editando um pedido** e clica para finalizar. Funciona igual em Android, iOS e Windows (janelas da própria tela, sem depender do navegador).

## Passo 1 — Conferir pagamento
Ao clicar em finalizar, o sistema confere se a **forma** e a **condição de pagamento** estão escolhidas.

Se faltar alguma, abre a janela:
"Deseja alterar as Condições de pagamento agora?"
- **Sim:** fecha a janela e leva o vendedor até os campos de forma/condição de pagamento (a tela rola até lá e destaca os campos). Nada é salvo ainda.
- **Não:** salva o pedido como **Pendente** e mostra o aviso: "O pedido só será transmitido com a Condição e a Forma de pagamento selecionadas."

Se estiver tudo escolhido, segue para o passo 2.

## Passo 2 — Liberar agora?
Com o pagamento completo, abre a janela:
"Deseja liberar p/ transmissão agora?"
- **Sim:** a janela mostra dois botões: **"Liberar p/ transmissão"** e **"Cancelar"**.
  - "Liberar p/ transmissão": salva o pedido e libera, usando a mesma regra de hoje (confere código do cliente, vendedor e itens; abre o WhatsApp de aviso; muda para "Liberado p/ transmissão"). Se faltar algo, o pedido fica Pendente e mostra o que falta.
  - "Cancelar": volta para a tela, sem salvar.
- **Não:** salva o pedido como **Pendente**, como já acontece hoje.

## O que não muda
- Pedido sem forma/condição continua bloqueado no servidor para liberar.
- Sem valor mínimo para vendedor/televendas, trocar cliente, orçamentos e o fluxo das outras lojas continuam iguais.

## Detalhes técnicos
- `CheckoutPage.tsx`: no envio, quando `editingQuote && sellerOrder && store.slug === 'dicolore'` e não for orçamento, interceptar antes de salvar: checar `paymentFormaCodigo`/`paymentCondicaoCodigo` do cliente selecionado; abrir AlertDialog 1 (Sim → scroll/foco na seção de pagamento; Não → salvar + toast de aviso). Senão AlertDialog 2 (Sim → estado com botões Liberar/Cancelar; Não → salvar normal).
- Extrair a lógica de liberação de `SellerPendingOrderDialog.release` para `src/lib/releaseOrder.ts` (validação `getReleaseIssues` + WhatsApp aberto antes do await para iOS + update para `liberado_transmissao`), reutilizada nos dois lugares.
- Função pura `nextFinalizeStep(...)` com testes: falta pagamento → pergunta pagamento; completo → pergunta liberação; outra loja → salva direto.
