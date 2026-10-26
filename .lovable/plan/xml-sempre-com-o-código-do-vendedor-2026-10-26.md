# XML sempre com o código do vendedor

## O que aconteceu (pedido 560, Senses)
- O pedido foi feito pelo representante **Daniel Schmitz** (código 345) pelo modo vendedor.
- O cliente (FAE) não tem cadastro com vendedor na loja, e o pedido não gravou o código do vendedor — só o nome de quem criou.
- Por isso `<codigoRepresentante>` saiu vazio. Antes, o bloqueio de código do cliente impedia esse download; ao liberar, apareceu essa falha.

## Correção
Ao gerar o arquivo, o código do vendedor é buscado nesta ordem, até achar um:
1. Vendedor do cadastro do cliente.
2. Código do vendedor gravado no pedido.
3. **Código de quem criou o pedido** (representante logado no modo vendedor), pelo cadastro de usuários da loja.
4. Vendedor escolhido no checkout (lista "Vendedores (WhatsApp)"), pelo nome.

Também passa a preencher `nomeRepresentante` com o nome desse vendedor.
Se nenhum for encontrado, o download do XML **é bloqueado** com o aviso "Pedido sem código do vendedor" — em todas as lojas (regra obrigatória, diferente do código do cliente).

Para pedidos novos feitos no modo vendedor, o código do representante passa a ser gravado no pedido no momento da criação.

## Detalhes técnicos
- `StoreAdminPage.buildDownloadExtra`: resolver `sellerCode` com fallback por `customer.createdByName/ownerName` → `store_users.seller_codes[0]`/`erp_code`, e por nome em `store_sellers`.
- Bloqueio em `runBulkDownload` e diálogo de download quando `sellerCode` vazio (formato XML).
- Ao criar pedido no modo vendedor (`SellerContext`/checkout), gravar `customer.sellerCode` com o código do vendedor logado quando ausente.
- Teste unitário do resolvedor (cadastro > pedido > criador > nome).
