

# Multiplas Imagens para Produtos com Variantes

## Objetivo
Permitir que produtos com variantes tenham multiplas fotos, com navegacao entre elas (carousel), para que o cliente visualize as variacoes de cor.

## Arquitetura

### 1. Nova tabela `product_images` no banco de dados

Criar uma tabela para armazenar multiplas imagens por produto:

```text
product_images
  - id (uuid, PK)
  - product_id (uuid, FK -> products.id, ON DELETE CASCADE)
  - image_url (text, NOT NULL)
  - sort_order (integer, default 0)
  - label (text, nullable) -- ex: "Azul", "Vermelho"
```

RLS: SELECT publico, INSERT/UPDATE/DELETE restrito a store admins (via join com products).

### 2. Alteracoes no cadastro (ProductFormDialog)

Quando `hasVariants = true`:
- Substituir o campo de imagem unica por uma area de upload multiplo
- Mostrar previews das imagens adicionadas com botao de remover
- Permitir reordenar e adicionar label (nome da cor) a cada imagem
- A imagem principal do produto (`image_url` na tabela products) sera a primeira imagem da galeria

### 3. Alteracoes na vitrine (ProductStorePage)

No dialog de selecao de variante:
- Exibir um carousel (usando o componente Embla ja instalado) com todas as imagens do produto
- Ao selecionar uma cor, navegar automaticamente para a imagem correspondente (via label)
- Mostrar indicadores de navegacao (dots ou setas)

### 4. Alteracoes no hook useProducts

- Incluir `product_images` no select junto com `product_variants`
- Mapear as imagens para o tipo Product (novo campo `images`)

### 5. Tipo Product atualizado

Adicionar ao tipo Product:
```text
images?: ProductImage[]

interface ProductImage {
  id: string;
  imageUrl: string;
  sortOrder: number;
  label?: string;
}
```

## Detalhes Tecnicos

### Migracao SQL

```text
CREATE TABLE public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  label text
);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read product_images"
  ON public.product_images FOR SELECT
  USING (true);

CREATE POLICY "Store admins can insert product_images"
  ON public.product_images FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_id
    AND (is_store_admin(auth.uid(), p.store_id) OR is_platform_admin(auth.uid()))
  ));

CREATE POLICY "Store admins can update product_images"
  ON public.product_images FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_id
    AND (is_store_admin(auth.uid(), p.store_id) OR is_platform_admin(auth.uid()))
  ));

CREATE POLICY "Store admins can delete product_images"
  ON public.product_images FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_id
    AND (is_store_admin(auth.uid(), p.store_id) OR is_platform_admin(auth.uid()))
  ));
```

### Arquivos a modificar

1. **src/types/index.ts** - Adicionar `ProductImage` e campo `images` em `Product`
2. **src/hooks/useProducts.ts** - Incluir `product_images(*)` no select e mapear
3. **src/components/ProductFormDialog.tsx** - Upload multiplo quando hasVariants=true
4. **src/pages/ProductStorePage.tsx** - Carousel no dialog de variantes
5. **src/lib/storage.ts** - Reutilizar `uploadProductImage` (ja funciona para multiplos uploads)

### Componentes utilizados

- Carousel do Embla (ja instalado em `src/components/ui/carousel.tsx`) para navegacao entre fotos na vitrine

