# Regras DiColore para Vendedor e Televendas

Vale para celular e computador (Android, iPhone e Windows, em qualquer navegador), porque tudo roda no próprio site.

## 1) Sem valor mínimo para Vendedor e Televendas
- Na DiColore, quando quem está logado é **Vendedor** ou **Televendas**, o aviso "Pedido mínimo" some e o botão de finalizar não fica bloqueado (no carrinho e na finalização).
- O **cliente** que faz o próprio pedido continua com o valor mínimo da loja.

## 2) Trocar o cliente antes de liberar
- No pedido **Pendente** (antes de "Liberar p/ transmissão"), aparece o botão **"Trocar cliente"**.
- Abre a busca de clientes da carteira do vendedor (nome, código ou CNPJ). Ao escolher, o pedido passa a usar o novo cliente: nome, código ERP, endereço e vendedor do cadastro.
- Depois de liberado para transmissão, a troca não é mais permitida.
- A troca também fica disponível dentro da edição completa (item 3).

## 3) Editar pelo mesmo jeito que cria
- Hoje o botão "Editar itens" abre uma lista simples. Ele passa a se chamar **"Editar pedido"** e abre o **catálogo**, com os itens do pedido já no carrinho e a faixa "Editando pedido de <cliente>".
- O vendedor adiciona, remove ou muda quantidades como na criação, revisa forma/condição de pagamento e salva. O mesmo pedido é atualizado (mesmo número) e volta como **Pendente**.
- Botão "Cancelar edição" na faixa descarta as mudanças.

## Detalhes técnicos
- `CheckoutPage.tsx` / `ProductStorePage.tsx`: pular `minOrderValue` quando loja é DiColore e o usuário é seller/televendas (`useSellerSession`).
- `SellerPendingOrderDialog.tsx`: trocar `EditOrderDialog` por carregar `order.items` no carrinho + `setEditingQuote({ id, storeId, customerName })` + selecionar o cliente do pedido e navegar para `/:slug`; reaproveita o fluxo de atualização já existente em `CheckoutPage` (linha ~548), mantendo status `pendente`.
- Novo seletor "Trocar cliente" (reusa a busca de clientes do portal do vendedor); atualiza `customer` do pedido com `.select().single()`; bloqueado se status ≠ pendente/orçamento.
- No checkout em modo edição, permitir trocar o cliente selecionado.
- Teste unitário da regra "mínimo ignorado para vendedor/televendas na DiColore, aplicado para cliente".
