## Causa encontrada

A barra de filtros de pedidos foi inserida no lugar errado: ela está dentro do `Card` da aba **Produtos** (linhas 1085-1124 de `StoreAdminPage.tsx`, logo acima da tabela com colunas Imagem/Código/Produto/Categoria), e não dentro da aba **Pedidos** (que começa na linha 1249 e vai direto do cabeçalho para a tabela de pedidos).

Por isso, ao abrir a aba Pedidos nada aparece — os campos estão renderizando na aba de Produtos.

## Correção

1. Remover o bloco de filtros (busca + select de representante + select de status + contador/Limpar) de dentro do Card da aba Produtos.
2. Inseri-lo na aba Pedidos, dentro do `Card`/`CardContent`, imediatamente antes da `<Table>` de pedidos.
3. Conferir que a paginação da aba Pedidos continua usando `searchedOrders`/`pagedOrders` (já está) e que o contador "X encontrado(s)" reflete os pedidos filtrados.

Sem mudanças de lógica, banco ou hooks — apenas reposicionamento do JSX em `src/pages/StoreAdminPage.tsx`.
