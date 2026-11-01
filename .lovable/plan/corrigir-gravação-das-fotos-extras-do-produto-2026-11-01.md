# Corrigir gravação das fotos extras do produto

## O que foi verificado
- Na JEWOS não há nenhuma foto extra gravada para produtos. Só existem as fotos que vieram do Bling (1 por produto).
- As permissões de gravação de fotos são as mesmas dos produtos, então não bloqueiam quem consegue editar o produto.
- A causa exata ainda não está confirmada. Há dois pontos suspeitos:
  1. A versão publicada da loja ainda não tem a mudança anterior. Se o cadastro foi feito pelo link publicado, a foto extra é descartada ao salvar.
  2. O nome do arquivo de cada foto usa só o horário em milissegundos. Duas fotos enviadas no mesmo instante podem ficar com o mesmo nome, e a segunda substitui a primeira.

## O que fazer
1. Testar na pré-visualização entrando como administrador da JEWOS: editar um produto sem variação, adicionar 2 fotos, salvar, reabrir e conferir no banco. Isso confirma a causa.
2. Dar a cada foto enviada um nome único (horário + código aleatório), para que nenhuma foto substitua outra.
3. Na hora de salvar, se apagar ou gravar as fotos der erro, mostrar o erro em vez de ignorá-lo.
4. Repetir o teste da etapa 1 até as 2 fotos aparecerem gravadas e na janela de detalhes da loja.
5. Pedir para publicar, para que a loja publicada também grave as fotos.

## Detalhes técnicos
- `src/lib/storage.ts` `uploadProductImage`: `fileName = ${storeId}/${Date.now()}-${crypto.randomUUID().slice(0,8)}.${ext}`.
- `src/hooks/useProducts.ts`: verificar o erro do `delete` de `product_images` no update e lançar caso ocorra.
- Teste via Playwright com sessão de admin da loja + `read_query` em `product_images`.
