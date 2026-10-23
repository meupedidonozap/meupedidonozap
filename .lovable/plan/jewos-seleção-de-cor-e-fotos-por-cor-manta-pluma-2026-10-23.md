# Jewos: seleção de cor e fotos por cor (Manta Pluma)

## O que acontece hoje
- As 3 fotos da Manta Pluma estão assim: foto 1 e 2 sem cor, foto 3 (que é a lilás) marcada como **Nude**. A Lilás não tem nenhuma foto ligada a ela.
- Por isso, ao clicar em Lilás, a tela não acha foto da Lilás, continua na foto marcada "Nude" e a própria foto puxa a seleção de volta para Nude. Parece que as duas ficam marcadas.
- A foto da Nude no Bling é igual à foto principal do produto; como a importação não repete foto, ela entrou sem a cor, e a etiqueta "Nude" acabou indo para a foto errada.

## Como vai ficar
1. **Seleção de cor**: clicar numa cor desmarca a outra sempre. Se a cor tiver foto, o carrossel vai até ela; se não tiver, o carrossel fica parado e não muda a cor escolhida. Só quando o cliente arrasta ou clica numa miniatura com cor é que a seleção acompanha a foto.
2. **Importação de fotos do Bling**: cada foto de variação recebe a cor da própria variação. Se a foto já existir no produto (ex.: igual à principal), ela ganha a etiqueta da cor em vez de ser ignorada. Etiquetas erradas de importações anteriores são corrigidas.
3. Reimportar a Manta Pluma na Jewos e conferir: Nude mostra a foto bege, Lilás mostra a lilás.

## Detalhes técnicos
- `src/components/VariantDialog.tsx`: usar um ref `syncFromSlide` — o efeito de `currentSlide` só altera a cor quando a mudança veio do usuário no carrossel (não após `handleColorSelect`); botão selecionado compara normalizado.
- `supabase/functions/bling-sync/index.ts`: mapear imagens por variação usando o nome da variação do Bling; no dedupe por URL de origem, atualizar `label` quando vazio/diferente; garantir ordem pai → variações.
- Rodar a etapa de fotos para a Jewos e validar labels em `product_images`.
