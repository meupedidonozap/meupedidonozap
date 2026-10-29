# Notas Fiscais: mesma regra no modo cliente e no modo vendedor

## Situação atual
As três telas usam o mesmo quadro de Notas Fiscais: o painel admin, "Minhas notas fiscais" do cliente e a seção "Notas" do portal do vendedor/televendas. Então a mudança anterior já vale para todas. O que já está em todas:
- Abas Hoje | 30 dias | Este mês | 90 dias | Todas, respeitadas mesmo com cliente pesquisado
- Sem observação da NF
- Sem data de entrega
- "Ver itens da nota" com código, produto, quantidade faturada, unitário e total

## O que falta fazer
1. Abrir a tela de notas como cliente (Janderson Rossoni) e como vendedor da carteira dele, para confirmar que o filtro, os itens e a ocultação aparecem iguais nas duas.
2. Se o vendedor ou o cliente não conseguir ver os itens por causa da permissão de acesso, liberar a leitura dos itens dos pedidos da própria carteira, seguindo a mesma regra que já vale para as notas.
3. Conferir a tela no celular: com 5 abas, ajustar o texto para não cortar.

## Detalhes técnicos
- Componente único: `src/components/InvoicesPanel.tsx`, usado em `CustomerInvoicesPage.tsx`, `SellerPortalPage.tsx` e `StoreAdminPage.tsx`.
- Os itens vêm de `erp_order_items` (chave `filial|pedido`). Antes de mudar a permissão, conferir se a política atual dessa tabela já cobre o cliente dono do código e a carteira do vendedor.
