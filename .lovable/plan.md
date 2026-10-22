# Pedidos DiColore com bolinha errada (ex.: 98855)

## O que foi encontrado
- O monitor está funcionando: o pedido 98855 já está gravado com **OF 236934, NF 209628/55, status F (com OF e com NF)**.
- O problema é o **código do cliente** que volta do ERP: para o 98855 veio `627cdd9bd10f6` em vez de **94967**.
- Como o vendedor só enxerga pedidos de clientes da carteira dele (pelo código do cliente), o pedido do ERP fica invisível para ele. A tela então mostra a cópia local do pedido (#521), que fica sempre vermelha.
- **663 de 1.712** pedidos do ERP estão com esse código errado — por isso "todos" parecem errados. Não é erro de exibição.

## O que será feito
1. Na gravação dos pedidos vindos do ERP: quando o código do cliente não for numérico, usar o código do cliente do pedido feito no site (ligado pelo número ERP ou pelo número do pedido).
2. Corrigir de uma vez os 663 pedidos já gravados com o mesmo critério (e os itens desses pedidos).
3. Na tela de Vendas > Pedidos: se o pedido do ERP existir, nunca mostrar a cópia local "vermelha" duplicada.
4. Verificar com sessão de vendedor que o 98855 aparece com a cor de **OF + NF**.

## Observação
- Pela legenda atual, pedido com OF e NF é **verde**; azul é "com OF e sem NF". O 98855 deve ficar verde. Se quiser outra cor, me avise.
- Também vale ajustar a view `vw_mpz_pedido` no ERP para devolver o código do parceiro (94967); a correção acima funciona mesmo sem isso.

## Detalhes técnicos
- `sync-titles`: antes do upsert de `erp_orders`, resolver `cliente_codigo` não numérico via `orders.erp_order_code = codigo_importacao` ou `order_number = codigo`, lendo `customer->>'customerCode'`; mesmo ajuste em `erp_order_items`.
- Backfill por migração SQL com o mesmo join.
- Teste de regressão para a regra de resolução do código.
