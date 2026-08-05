## Objetivo

Adicionar uma barra de filtros na aba **Pedidos** do painel da loja, com busca por cliente (nome, código ou WhatsApp), filtro por representante/vendedor e filtro por status do pedido.

## Como funciona hoje (verificado)

- A aba Pedidos lista `pagedOrders`, uma fatia paginada de `scopedOrders` (pedidos já restritos ao vendedor logado, quando aplicável).
- Cada linha já resolve o código do cliente (`resolveCustomerCode`) e o nome do vendedor (`resolveOrderSellerName`) a partir do WhatsApp/CPF do pedido.
- Não existe hoje nenhum campo de busca ou filtro nessa aba — só paginação (20/página).

## O que será feito

1. **Barra de filtros** acima da tabela de pedidos (mesmo padrão visual já usado na aba Clientes):
   - Campo de busca livre: número do pedido, nome do cliente, código do cliente, WhatsApp (com busca também só por dígitos).
   - Select "Representante": "Todos" + lista de vendedores da loja (mais opção "Sem representante").
   - Select "Status": "Todos" + os status já existentes dos pedidos (Pendente, Em preparação, Pronto, Entregue, Cancelado etc., conforme os valores atuais).
   - Botão "Limpar filtros" quando algum filtro estiver ativo, e contador de pedidos encontrados.

2. **Lógica de filtragem**
   - Novo `filteredOrders` derivado de `scopedOrders`, aplicando os três filtros combinados.
   - Paginação passa a operar sobre `filteredOrders` (contagem, "Mostrando X–Y de Z" e total de páginas), voltando para a página 1 quando um filtro muda.
   - Representante resolvido pela mesma função já usada na exibição da linha, para manter consistência com o que aparece na tabela.

3. **Escopo preservado**
   - Vendedores com acesso restrito continuam vendo somente os pedidos deles; os filtros atuam dentro desse escopo.

## Detalhes técnicos

- Alterações apenas em `src/pages/StoreAdminPage.tsx` (estados `orderSearch`, `orderSellerFilter`, `orderStatusFilter`, um `useMemo` de filtragem e a UI de filtros).
- Sem mudanças de banco, hooks ou edge functions.
