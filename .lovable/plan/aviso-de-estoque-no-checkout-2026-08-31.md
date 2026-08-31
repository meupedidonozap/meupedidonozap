# Aviso de estoque no checkout

Adicionar um aviso fixo abaixo do botão principal de finalização do pedido no checkout, visível em todas as lojas (com ênfase especial para Dicolore e Senses).

## O que será feito

1. **Inserir aviso no `CheckoutPage.tsx`**
   - Local: imediatamente abaixo do botão "Enviar pelo WhatsApp" / "FINALIZAR PEDIDO", dentro do card "Resumo do Pedido".
   - Texto exato: "Devido ao alto giro da plataforma, produtos podem ficar sem estoque sem prévio aviso."
   - Estilo: banner discreto em tom de informação/alerta (ex.: fundo `muted/50` ou `yellow-50`, texto `muted-foreground` ou `yellow-900`) para não competir visualmente com o botão de ação.
   - O aviso será fixo, sem condicionais de loja, já que o usuário pediu "FIXO para todos os pedidos".

2. **Garantir responsividade**
   - O aviso deve acompanhar a largura do card de resumo e manter legibilidade em mobile.
   - Padding e tamanho de fonte compatíveis com o restante do checkout.

## Arquivos envolvidos

- `src/pages/CheckoutPage.tsx`: adicionar o elemento de aviso logo após o botão de envio (linhas ~876-883).

## Critérios de aceitação

- O aviso aparece em todos os checkouts, abaixo do botão verde de finalização.
- O layout do card de resumo não quebra em desktop nem mobile.
- Nenhuma lógica de envio ou validação do checkout é alterada.
