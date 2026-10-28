# Pedidos Pendentes por carteira (DiColore e demais lojas)

## Regra
- **Vendedor:** a contagem "Pedidos Pendentes", o número vermelho na aba "Pedidos" e a lista de pedidos só mostram pedidos de clientes da carteira dele (clientes cadastrados com o código de vendedor dele).
- **Televendas:** mostra pedidos de clientes da carteira dos vendedores ligados a ele.
- **Admin da loja / admin da plataforma:** continua vendo todos.
- Se não houver nenhum pendente da carteira, o número vermelho não aparece.

## O que muda
1. Uma única regra "este pedido é da minha carteira?" usada pelo painel: o código do cliente do pedido precisa estar no cadastro de clientes com um dos códigos de vendedor do usuário (mesma regra já usada para Títulos e Notas Fiscais). Se o pedido não tiver código de cliente, usa o código de vendedor gravado no pedido.
2. No painel: a lista de pedidos, o cartão "Pedidos Pendentes", o número na aba "Pedidos" e os "Pedidos Recentes" passam a usar só os pedidos da carteira quando o usuário não for admin.
3. Avisos de novo pedido (notificação) para vendedor/televendas seguem a mesma carteira (o texto já diz "pedido pendente para o seu cliente"; confirmo que o envio respeita isso).
4. Segurança no banco: hoje existe uma permissão que deixa qualquer pessoa ler pedidos "pendente/em preparação" (feita para a tela da cozinha). Ela será limitada às lojas de comida/pizzaria, para que vendedores não recebam pedidos de outras carteiras nem por fora da tela.
5. Teste automático da regra: vendedor vê só a carteira, televendas vê a carteira dos seus vendedores, admin vê tudo.

## Detalhes técnicos
- Novo helper `src/lib/orderPortfolio.ts` (`isOrderInPortfolio(order, portfolioCustomerCodes, sellerCodes)`) + `orderPortfolio.test.ts`.
- `StoreAdminPage.tsx`: buscar códigos de cliente da carteira (`customer_profiles` por `seller_code IN userSellerCodes`, normalizando código) e aplicar sobre `orders` antes de `filteredOrders`/`stats`/badge quando `!isAdmin`.
- Migração: restringir a policy "Public read kitchen orders" a lojas `type IN ('COMIDA','PIZZARIA')` (verificar antes uso pela `/:slug/cozinha`).
- Conferir `notify_new_pending_order` / função de push quanto à carteira.
