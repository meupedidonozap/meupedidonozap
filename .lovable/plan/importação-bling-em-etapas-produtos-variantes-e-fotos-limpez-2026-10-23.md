# Importação Bling em etapas (produtos, variantes e fotos) + limpeza da Jewos

## Causa do erro
A importação tenta fazer tudo de uma vez: ler os 436 produtos, abrir o detalhe de cada produto com variação, baixar e guardar todas as fotos. Isso passa do tempo máximo que o servidor permite para uma chamada (cerca de 2,5 minutos), e ele corta a chamada no meio. Por isso aparece "Edge Function returned a non-2xx status code".

## O que será feito
1. **Apagar os produtos da Jewos no MPZ** (436 produtos, com as variantes, fotos e itens de kit deles), para recomeçar do zero a partir do Bling.
   - A loja tem 2 pedidos de teste. Eles guardam uma cópia dos itens, então continuam abrindo normalmente.
2. **Importação em etapas, com barra de progresso**
   - Etapa 1: lista os produtos do Bling (rápido).
   - Etapa 2: processa em lotes de 10 produtos por vez (produto pai, variantes, preço, estoque e situação).
   - Etapa 3: fotos em lotes pequenos, separadas, para nunca estourar o tempo.
   - A tela mostra "Importando 40 de 436..." e, no fim, o resumo: produtos novos, variantes, fotos e erros.
   - Se cair no meio, clicar de novo continua sem duplicar nada.
3. **Leitura correta da API do Bling (v3), válida para qualquer loja ligada ao Bling**
   - Produto com variação (formato V): vira 1 produto com "Possui Variantes", e cada variação vira uma variante (Cor e Tamanho lidos de "Cor:Lilás;Tamanho:P"; outros atributos entram junto).
   - Variações não aparecem como produtos soltos.
   - Estoque de cada variação vem do saldo do Bling; variação inativa fica com estoque 0.
   - Preço: o da variação; se vier zerado, usa o do produto pai.
   - Descrição curta, unidade e marca/categoria, quando existirem.
   - Fotos: do produto pai (carrossel) e de cada variação (marcadas com a cor). São baixadas e guardadas no MPZ, porque os links do Bling expiram.
   - Produto composto (formato E) entra como produto simples.
4. **Estoque automático a cada 15 min**: continua, agora só atualizando estoque e situação (sem fotos), em lotes, para todas as lojas conectadas.
5. Mensagens de erro claras na tela (ex.: "Bling desconectado — reconecte"), em vez do erro genérico.

## Detalhes técnicos
- Limpeza (dados): apagar `product_images`, `product_variants`, `product_kit_items`, `product_assembly` e `products` da loja `jewosnewborn`, além da pasta `bling/` da loja no armazenamento.
- `supabase/functions/bling-sync/index.ts`:
  - Ações novas: `list` (retorna ids e formato, paginado), `products_batch` (recebe até 10 ids; busca `/produtos/{id}` com `variacoes[]` e `midia`; saldos via `/estoques/saldos?idsProdutos[]=`), `images_batch` (recebe até 5 ids de produto do MPZ e os links do Bling).
  - Upsert por `bling_code` (pai) e `sku` (variante); tudo idempotente.
  - Pausa de 350 ms entre chamadas (limite de 3 req/s do Bling); trata 429.
  - `cron` processa só estoque e situação a partir da listagem + saldos, sem buscar detalhe por produto quando nada mudou.
  - Erros retornam 200 com `{ error }` legível; o painel mostra o texto.
- `src/components/BlingConnectCard.tsx`: laço no navegador chamando os lotes, barra de progresso e resumo final.
- Validação: importar a Jewos completa e conferir Manta Pluma (2 variantes + fotos) e Manta Soft.
