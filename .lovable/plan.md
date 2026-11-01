# Etiqueta SuperFrete no pedido (JEWOS)

## Como fica hoje
- O cliente escolhe PAC/SEDEX no checkout com preço real do SuperFrete, e o pedido grava o serviço, valor e prazo.
- Não existe geração de etiqueta: a loja teria que entrar no site do SuperFrete e digitar tudo de novo.

## O que vamos fazer
1. **No pedido (admin da loja)**: bloco "Envio SuperFrete" mostrando serviço escolhido, valor, prazo e endereço de entrega.
2. **Botão "Gerar etiqueta"**: envia ao SuperFrete remetente (dados da loja), destinatário (cliente), produtos, peso/medidas e o serviço escolhido. A etiqueta é criada e paga com o saldo da conta SuperFrete da loja.
3. **Botão "Imprimir etiqueta"**: abre o PDF da etiqueta para imprimir.
4. **Código de rastreio**: salvo no pedido, exibido no admin e com botão para enviar ao cliente pelo WhatsApp.
5. **Filtro "A despachar"** na lista de pedidos: pedidos com entrega SuperFrete ainda sem etiqueta.
6. **Cancelar etiqueta** (enquanto não postada), devolvendo o saldo.
7. Pedidos "Retirar na loja" não mostram esse bloco.

## Pré-requisitos da loja
- Conta SuperFrete com saldo (etiqueta é paga na geração).
- Endereço completo da loja (rua, número, bairro, CPF/CNPJ) nas configurações.
- Peso/medidas padrão já configurados (0,5 kg, 20x15x10).

## Detalhes técnicos
- Nova função de backend `superfrete-label` com ações: `create` (POST /api/v0/cart), `checkout` (POST /api/v0/checkout), `print` (POST /api/v0/tag/print → URL do PDF), `cancel`, `info` (rastreio). Usa o segredo `SUPERFRETE_TOKEN`; só admin da loja pode chamar.
- Migração: colunas novas em `orders`: `shipping_label_id`, `shipping_label_status`, `shipping_label_url`, `shipping_tracking`, `shipping_label_created_at` (todas opcionais).
- Mapear `shipping_code` "SF-1/2/17" para o serviço SuperFrete.
- UI no detalhe do pedido em StoreAdminPage + filtro "A despachar".
