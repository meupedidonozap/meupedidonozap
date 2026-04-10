

# Ajustar exibição de imagens nos quadros da vitrine

## Problema

Imagens de alta resolução com proporções diferentes do quadro (ex: retangulares, verticais) ficam cortadas ou "vazando" porque o CSS usa `object-cover`, que preenche o quadro inteiro cortando o excesso. Para um catálogo virtual profissional, o ideal é que a imagem caiba inteira no quadro, como fazem sistemas de catálogo — mostrando o produto completo com fundo limpo.

## Solução

Trocar `object-cover` por `object-contain` nas imagens de produto da vitrine e do admin. Isso faz a imagem inteira caber no quadro sem cortar nada. O espaço que sobrar fica com fundo branco (ou cinza claro), criando uma apresentação limpa e padronizada — exatamente como catálogos profissionais fazem.

```text
object-cover  → corta a imagem para preencher o quadro (problema atual)
object-contain → encaixa a imagem inteira dentro do quadro (solução)
```

A compressão de 800x800px já implementada continua perfeita — o tamanho do arquivo fica pequeno, e o CSS cuida de encaixar visualmente no quadro.

## Alterações

### `src/pages/ProductStorePage.tsx`
- **Grid view** (quadro quadrado): trocar `object-cover` por `object-contain` e adicionar `bg-white` no container
- **List view** (miniatura): trocar `object-cover` por `object-contain` e adicionar `bg-white`
- **Carrinho** (miniatura): manter `object-cover` (é pequeno, não precisa)

### `src/pages/StoreAdminPage.tsx`
- Tabela de produtos no admin: trocar `object-cover` por `object-contain bg-white` na miniatura

### `src/pages/FoodStorePage.tsx`
- Miniatura do item: trocar `object-cover` por `object-contain bg-white`

## Resultado esperado

- Todas as fotos de produto ficam enquadradas corretamente, sem cortar
- Produtos com fotos retangulares ou verticais aparecem inteiros
- Fundo branco limpo no espaço que sobra — visual de catálogo profissional
- Não precisa reeditar nenhuma imagem manualmente

