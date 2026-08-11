# Checkout da DiColore Senses: remover TXT e renomear botão

## O que muda

No resumo do pedido (tela de finalização) da loja `dicoloresenses`:

1. O botão **Baixar TXT** deixa de aparecer.
2. O botão verde **Enviar pelo WhatsApp** passa a exibir **FINALIZAR PEDIDO**.

Nenhuma outra loja é afetada, e o comportamento do envio (criação do pedido e abertura do WhatsApp) continua igual.

## Detalhes técnicos

Arquivo: `src/pages/CheckoutPage.tsx` (bloco de botões, ~linha 752).

- A condição atual `store.slug !== 'dicolore'` que esconde o botão TXT passa a esconder também para `dicoloresenses` (usar uma lista de slugs sem exportação TXT).
- O rótulo do botão principal passa a ser `FINALIZAR PEDIDO` quando o slug for `dicoloresenses`; demais lojas mantêm `Enviar pelo WhatsApp`. Estados "Enviando..." e "Loja fechada" permanecem.
