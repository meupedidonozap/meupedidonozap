# Senses: preço da Tabela 11 no painel — publicar e limpar cache

## Situação verificada agora

- O código do painel já usa a Tabela 11 na Senses: o cabeçalho da lista de Produtos é montado com a tabela ativa da loja e o valor exibido é o preço resolvido nessa tabela.
- O formulário "Editar Produto" já recebe a loja e usa a Tabela 11 como campo principal na Senses.
- A própria imagem enviada mostra a coluna "Preço (Tab. 11)" com R$ 31,00 / R$ 31,30 / R$ 21,00 — ou seja, no ambiente de preview a correção está aplicada.

Conclusão: não há bug pendente no código. O que resta é a versão publicada / o cache do navegador do usuário, que ainda serve os arquivos antigos.

## O que será feito

1. **Publicar a atualização** para que o site publicado (meupedidonozap) passe a servir a versão nova do painel.
2. **Forçar a troca de versão no navegador**: garantir que, após publicar, o app registre a nova versão e descarte a anterior — caso ainda apareça valor antigo, acessar o painel com `?limpar` no final da URL, que aciona a limpeza de cache e o service worker é reinstalado.
3. **Conferência final**: abrir `/dicoloresenses/admin` na aba Produtos e confirmar cabeçalho "Preço (Tab. 11)" com R$ 31,00 no BARBER SHOP 4X4, e abrir "Editar Produto" desse item confirmando 31,00 no campo principal.

Se, depois de publicar e limpar o cache, ainda aparecer 0,00 em alguma tela específica, o próximo passo é identificar essa tela (vitrine, carrinho ou XML) e tratá-la separadamente — nenhuma outra loja é afetada.

## Detalhes técnicos

- Nenhuma alteração de código nova é necessária para a lista e para o formulário: `StoreAdminPage.tsx` (linhas do cabeçalho e da célula de preço) e `ProductFormDialog.tsx` (`mainPriceTable = resolveStorePriceTable(storeSlug)`) já estão corretos.
- Ação principal: deploy (Publish) e invalidação de cache do PWA via `CacheBuster` (`?limpar`).
