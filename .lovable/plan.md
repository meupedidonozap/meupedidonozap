

# Otimizar performance de imagens na loja

## Problema

As imagens são enviadas no tamanho original (sem compressão) e todas carregam de uma vez na página, causando lentidão.

## Solução (duas frentes)

### 1. Comprimir imagens no upload (`src/lib/storage.ts`)

Antes de enviar ao storage, redimensionar e comprimir a imagem no navegador usando Canvas:
- Resolução máxima: 800x800px (suficiente para vitrine)
- Formato: WebP (70-80% menor que JPEG)
- Qualidade: 0.8
- Fallback para JPEG se o navegador não suportar WebP

Isso reduz imagens de 2-5MB para 50-150KB.

### 2. Lazy loading nas imagens da vitrine (`src/pages/ProductStorePage.tsx`)

Adicionar `loading="lazy"` em todas as tags `<img>` da listagem de produtos (list view e grid view). O navegador só carrega a imagem quando ela está prestes a aparecer na tela.

Também adicionar nos componentes:
- `src/components/VariantDialog.tsx` — imagens do carrossel

### 3. Recomprimir imagens existentes (script único)

Criar um botão no admin "Otimizar imagens" que reprocessa as imagens já salvas, ou orientar o usuário que as novas fotos já serão otimizadas e as antigas podem ser reenviadas gradualmente.

## Arquivos modificados

- `src/lib/storage.ts` — adicionar função de compressão com Canvas antes do upload
- `src/pages/ProductStorePage.tsx` — `loading="lazy"` nas `<img>`
- `src/components/VariantDialog.tsx` — `loading="lazy"` nas `<img>`

## Resultado esperado

- Upload de fotos 5-10x menor em tamanho
- Página carrega muito mais rápido (imagens só carregam quando visíveis)
- Qualidade visual mantida para o contexto de vitrine

