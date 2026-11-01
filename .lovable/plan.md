# Mais fotos para produtos sem variação

## Problema
No cadastro do produto, a área de "várias fotos" só aparece e só é salva quando o produto tem variações. Produto com uma única variação fica limitado a 1 foto.

## O que muda
- No cadastro/edição de qualquer produto (com ou sem variação), aparece a seção **"Fotos do produto"**: adicionar várias fotos, remover e escolher a ordem (a primeira é a principal).
- A foto principal atual continua funcionando; as fotos extras se somam a ela.
- Na loja, ao tocar na foto, a janela de detalhes já mostra todas as fotos (setas, miniaturas e deslizar no celular).
- A sincronização "Sincronizar" do Bling continua sem mexer nas fotos já cadastradas no MPZ.

## Detalhes técnicos
- `ProductFormDialog.tsx`: mostrar o bloco de multi-imagens também quando `hasVariants` for falso; enviar `images: uploadedImages` sempre (remover o `hasVariants ?`). Em produto sem variação, não usar rótulo de cor/tamanho nas fotos.
- Upload em `uploadProductImage` (WebP 800x800) reaproveitado.
- `useProducts.ts` já grava/lê `product_images` sem depender de variações — sem mudança de banco.
- `ProductDetailDialog.tsx` já junta `image` + `images`; sem mudança.
