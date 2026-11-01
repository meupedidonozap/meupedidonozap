# Pedidos da JEWOS no painel do SuperFrete

## Objetivo
Cada pedido com entrega pelo SuperFrete entra sozinho no painel do SuperFrete da JEWOS (aba de etiquetas pendentes / carrinho), igual aos pedidos dos outros marketplaces. A equipe paga, imprime a etiqueta e despacha por lá, como já faz hoje.

## Como vai funcionar
1. **Envio automático**: quando o pedido é feito com PAC/SEDEX/Mini Envios, o MPZ manda ao SuperFrete: remetente (dados da loja), destinatário (nome, CPF, endereço do cliente), serviço escolhido, produtos com quantidade e valor, peso e medidas.
2. **No painel do SuperFrete**: o pedido aparece como etiqueta pendente, com o número do pedido do MPZ. A loja paga e imprime lá.
3. **No admin do MPZ**: cada pedido mostra "Enviado ao SuperFrete" (ou erro com botão "Reenviar ao SuperFrete"), e o código de rastreio quando a etiqueta for gerada, com botão para mandar ao cliente pelo WhatsApp.
4. Pedidos "Retirar na loja" não são enviados.
5. Opcional depois: botões "Pagar e imprimir" direto no MPZ.

## Pré-requisitos da loja
- Endereço completo da loja e CPF/CNPJ nas configurações (o SuperFrete exige).
- Cliente com CPF no cadastro (o checkout passa a pedir se faltar, para pedidos com SuperFrete).

## Detalhes técnicos
- Nova função de backend `superfrete-label`: `create` → POST `/api/v0/cart` (cria etiqueta pendente no painel, com `platform: "Meu Pedido no Zap"` e `tag` = número do pedido); `info` → GET `/api/v0/order/info/{id}` para status e rastreio; usa o segredo `SUPERFRETE_TOKEN` e o header `User-Agent` exigido pela API.
- Chamada após gravar o pedido no checkout (sem bloquear o envio pelo WhatsApp) e pelo botão "Reenviar" no admin (somente admin da loja).
- Migração: colunas opcionais em `orders`: `superfrete_id`, `superfrete_status`, `superfrete_error`, `shipping_tracking`.
- Atualização do rastreio: consulta ao abrir o pedido no admin.
- Mapear `shipping_code` "SF-1/2/17" para o serviço SuperFrete.
