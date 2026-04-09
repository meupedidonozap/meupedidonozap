

# Recomprimir imagens existentes no storage

## Problema

A compressão implementada só atua em **novas** imagens. As fotos já enviadas continuam no tamanho original (2-5MB cada), causando lentidão na loja.

## Solução

Criar um botão **"Otimizar Imagens"** na aba de Configurações do admin da loja. Ao clicar:

1. Lista todos os produtos da loja que têm imagem
2. Para cada imagem, baixa do storage → comprime no navegador (mesma função Canvas 800x800 WebP) → faz upload substituindo o arquivo
3. Mostra progresso: "Otimizando 3/25..."
4. Ao terminar, mostra quantas foram otimizadas

## Fluxo

```text
Admin clica "Otimizar Imagens"
       ↓
Busca produtos com image_url
       ↓
Para cada imagem:
  fetch(url) → blob → compressImage() → upload(upsert:true)
       ↓
Progresso: "5 de 25 otimizadas..."
       ↓
Toast: "25 imagens otimizadas!"
```

## Arquivos modificados

- **`src/lib/storage.ts`** — exportar `compressImage` e criar função `recompressExistingImage(imageUrl, storeId)` que baixa, comprime e reenvia
- **`src/pages/StoreAdminPage.tsx`** — adicionar botão "Otimizar Imagens" na aba Configurações com barra de progresso

## Detalhe técnico

- A função usa `fetch(imageUrl)` para baixar a imagem existente como blob
- Converte para `File`, passa pelo `compressImage` (800x800, WebP, 0.8)
- Faz `upload` com `upsert: true` no **mesmo path** extraído da URL original
- Também processa imagens da tabela `product_images` (fotos de variantes)
- Imagens que já são pequenas (<100KB) são puladas automaticamente

## Resultado esperado

- Um clique otimiza todas as fotos antigas da loja
- A loja carrega muito mais rápido após a otimização
- Processo mostra progresso visual para o admin

