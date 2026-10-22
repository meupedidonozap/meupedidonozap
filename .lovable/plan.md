# Pagamento estilo Havan: confirma primeiro, depois manda o pedido

## Resposta direta
Sim: a página "Pagar agora" (Meus Pedidos e link enviado pela loja) já permite escolher PIX ou Cartão de novo quando o pagamento falha ou é abandonado.

## O que muda

### PIX
- Ao gerar o PIX, a tela mostra QR Code + copia e cola + "Aguardando pagamento..." com um contador.
- A cada 4 segundos a tela consulta o Mercado Pago. Quando ele aprovar, a tela de PIX fecha sozinha e aparece a tela **"Pagamento confirmado — Pedido #X PAGO"**.
- Só nessa tela aparece o botão **"Enviar pedido no WhatsApp"** (mensagem já informa "Pagamento confirmado via PIX").
- Remover o botão "Já paguei — enviar pedido e comprovante" e o texto de comprovante.
- Se o cliente fechar a tela antes de pagar: aviso "Seu pedido ficou aguardando pagamento — você pode pagar em Meus Pedidos" (o link continua funcionando).

### Cartão
- Após o checkout do Mercado Pago, o cliente volta para uma página de retorno do pedido (em vez da vitrine).
- Essa página consulta o Mercado Pago: 
  - Aprovado: "Pagamento confirmado — Pedido PAGO" + botão "Enviar pedido no WhatsApp".
  - Em análise: "Aguardando confirmação..." e continua verificando sozinha.
  - Recusado/cancelado: "Pagamento não aprovado" + botões "Tentar de novo (Cartão)" e "Pagar com PIX".

### Loja
- O pedido passa para PAGO automaticamente (já funciona via aviso do Mercado Pago); o WhatsApp do cliente não é mais tratado como comprovante.

## Detalhes técnicos
- `PixPaymentDialog`: polling 4s via `mercadopago` action `status`; ao `paid` mostra estado confirmado; remover botão WhatsApp do estado não pago; `whatsappUrl` com texto de pagamento confirmado.
- `CheckoutPage`: só limpar carrinho/navegar após o diálogo fechar; ao fechar sem pagar, toast com orientação.
- `mercadopago` function: `back_urls` passam a apontar para `/{slug}/pagar/{orderId}?retorno=1` (domínio publicado), todas as três.
- `PayOrderPage`: com `retorno=1`, verificar status em loop (até ~2 min), exibir aprovado / pendente / recusado com opções de nova tentativa; botão WhatsApp só quando pago.
- Lojas sem Mercado Pago (PIX estático) mantêm o fluxo atual com confirmação manual.
