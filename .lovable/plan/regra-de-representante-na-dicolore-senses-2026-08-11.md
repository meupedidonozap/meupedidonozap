# Regra de Representante na Dicolore SENSES

Replicar da DiColore para a SENSES apenas a regra de representante: o cliente escolhe o vendedor ao finalizar o pedido.

## Situação atual

- O bloco "📱 Enviar pedido para" no checkout já é genérico: ele aparece sempre que a loja tem vendedores ativos cadastrados.
- A Dicolore SENSES hoje tem **0 vendedores cadastrados**, e o painel dela não mostra o card de cadastro de vendedores (está travado só para o slug `dicolore`).

## O que muda

1. **Painel da SENSES → Configurações**: passa a exibir o card **"Vendedores (WhatsApp)"**, com nome, código e WhatsApp, igual ao da DiColore. Você cadastra os vendedores manualmente.
2. **Aba Pedidos da SENSES**: o filtro "Todos os representantes" passa a listar os vendedores cadastrados, e o nome do vendedor aparece junto ao cliente.
3. **Checkout da SENSES**: assim que houver vendedores cadastrados, o cliente verá o campo obrigatório "Enviar pedido para" e escolherá o vendedor — mesmo comportamento da DiColore.
4. **Vínculo cliente–vendedor igual à DiColore**: se o cliente tiver Código Vendedor preenchido no cadastro, o checkout mostra apenas o vendedor dele (mais televendas ligados a ele); sem vínculo, mostra todos os vendedores ativos. Essa lógica já é genérica e passa a valer automaticamente.

Nenhum vendedor é copiado da DiColore, e nada muda para as demais lojas.

## Detalhes técnicos

Arquivo: `src/pages/StoreAdminPage.tsx`

- Criar uma constante local com os slugs que usam a regra de representante (`dicolore`, `dicoloresenses`).
- Trocar `store?.slug === 'dicolore'` por essa verificação em dois pontos: a query `useAllStoreSellers` (linha ~181) e a renderização do card "Vendedores (WhatsApp)" (linha ~2138).
- Demais gates com `slug === 'dicolore'` (estoque, comissão de categoria, atendimento, sync de clientes, códigos de pagamento) permanecem inalterados.
- `CheckoutPage.tsx`, `useOrderRecipients` e a função `get_order_recipients` já são genéricos por `store_id` — sem alterações.
