# Salvar orçamento em edição sempre atualiza o mesmo orçamento

## Como funciona hoje
- Quando o vendedor toca em "Editar" num orçamento, o sistema marca qual orçamento está sendo editado. Ao salvar, ele atualiza esse orçamento e não cria outro. Esse caminho já está certo.
- O problema: a marca de "editando o #X" fica guardada só na aba aberta, mas o carrinho fica guardado no aparelho. Se o celular fecha o app, a aba é recarregada ou o vendedor abre o catálogo em outra aba, a marca se perde e o carrinho continua cheio. Aí o "Salvar" cria um orçamento novo. É assim que podem ter nascido cópias como #754 e #756.
- A trava que entrou agora evita cópia de carrinho idêntico. Mas, se o vendedor alterar um item depois que a marca se perdeu, ainda nasceria um orçamento novo.

## O que vou fazer (só DiColore)
1. Guardar a marca "editando o #X" junto com o carrinho, no aparelho. Ela continua valendo depois de fechar o app, recarregar ou trocar de aba, até salvar ou cancelar a edição.
2. Ao salvar com a marca ativa, sempre atualizar o mesmo orçamento, mesmo com itens alterados. Nunca cria outro.
3. Se o orçamento não puder mais ser editado (já foi liberado, transmitido ou cancelado), mostrar o aviso "O orçamento #X não está mais em edição" e não criar outro sem o vendedor confirmar.
4. A faixa "Editando orçamento de ..." continua visível no catálogo enquanto a edição estiver ativa, para o vendedor saber que vai atualizar o #X.
5. Testes: salvar em edição atualiza o mesmo número; a marca sobrevive a uma recarga; cancelar a edição limpa a marca.

## Detalhes técnicos
- Passar a guarda da edição do armazenamento da aba para o armazenamento do aparelho, separado por loja, mantendo o aviso entre abas. Limpar ao salvar, cancelar ou esvaziar o carrinho.
- No caminho de edição, conferir o retorno da atualização. Se nenhuma linha voltar (por causa de status ou permissão), abortar com o aviso, sem cair na criação de pedido novo.
- Atualizar o aviso de nova versão só para a DiColore.
