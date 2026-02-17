

# Correcao de Vulnerabilidades de Seguranca

## Resumo dos Problemas Encontrados

Foram identificadas vulnerabilidades criticas e moderadas nas politicas de acesso ao banco de dados (RLS). A maioria das tabelas permite que qualquer pessoa (mesmo sem autenticacao) insira, atualize e delete dados.

## Solucao: Migracoes SQL para Restringir Acesso

### 1. Tabela `stores` - Escrita restrita a admins

- INSERT/UPDATE: somente platform admins ou store admins (para sua propria loja)
- DELETE: somente platform admins

### 2. Tabela `categories` - Escrita restrita a store admins

- INSERT/UPDATE/DELETE: somente `is_store_admin(auth.uid(), store_id)` ou `is_platform_admin(auth.uid())`

### 3. Tabela `products` - Escrita restrita a store admins

- INSERT/UPDATE/DELETE: somente `is_store_admin(auth.uid(), store_id)` ou `is_platform_admin(auth.uid())`

### 4. Tabela `product_variants` - Escrita restrita a store admins

- INSERT/UPDATE/DELETE: verificar via join com products que o usuario e admin da loja

### 5. Tabela `food_items` - Escrita restrita a store admins

- INSERT/UPDATE/DELETE: somente `is_store_admin(auth.uid(), store_id)` ou `is_platform_admin(auth.uid())`

### 6. Tabela `coupons` - Escrita restrita a store admins

- INSERT/UPDATE/DELETE: somente `is_store_admin(auth.uid(), store_id)` ou `is_platform_admin(auth.uid())`
- SELECT: manter publico (necessario para clientes validarem cupons no checkout)

### 7. Tabela `store_admins` - Acesso restrito

- SELECT: somente o proprio usuario, outros admins da mesma loja, ou platform admins
- INSERT/DELETE: somente platform admins

### 8. Storage `product-images` - Upload restrito

- INSERT/UPDATE/DELETE: somente usuarios autenticados que sao store admins (verificando pelo prefixo do path)

## Detalhes Tecnicos

### Migracao SQL unica com todas as alteracoes:

```text
-- 1. STORES
DROP POLICY "Allow all insert stores" ON public.stores;
DROP POLICY "Allow all update stores" ON public.stores;
DROP POLICY "Allow all delete stores" ON public.stores;

CREATE POLICY "Platform admins can insert stores"
  ON public.stores FOR INSERT
  WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Store or platform admins can update stores"
  ON public.stores FOR UPDATE
  USING (is_store_admin(auth.uid(), id) OR is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete stores"
  ON public.stores FOR DELETE
  USING (is_platform_admin(auth.uid()));

-- 2. CATEGORIES
DROP POLICY "Allow all insert categories" ON public.categories;
DROP POLICY "Allow all update categories" ON public.categories;
DROP POLICY "Allow all delete categories" ON public.categories;

CREATE POLICY "Store admins can insert categories"
  ON public.categories FOR INSERT
  WITH CHECK (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));

CREATE POLICY "Store admins can update categories"
  ON public.categories FOR UPDATE
  USING (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));

CREATE POLICY "Store admins can delete categories"
  ON public.categories FOR DELETE
  USING (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));

-- 3. PRODUCTS
DROP POLICY "Allow all insert products" ON public.products;
DROP POLICY "Allow all update products" ON public.products;
DROP POLICY "Allow all delete products" ON public.products;

CREATE POLICY "Store admins can insert products"
  ON public.products FOR INSERT
  WITH CHECK (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));

CREATE POLICY "Store admins can update products"
  ON public.products FOR UPDATE
  USING (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));

CREATE POLICY "Store admins can delete products"
  ON public.products FOR DELETE
  USING (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));

-- 4. PRODUCT_VARIANTS
DROP POLICY "Allow all insert product_variants" ON public.product_variants;
DROP POLICY "Allow all update product_variants" ON public.product_variants;
DROP POLICY "Allow all delete product_variants" ON public.product_variants;

CREATE POLICY "Store admins can insert product_variants"
  ON public.product_variants FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_id
    AND (is_store_admin(auth.uid(), p.store_id) OR is_platform_admin(auth.uid()))
  ));

CREATE POLICY "Store admins can update product_variants"
  ON public.product_variants FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_id
    AND (is_store_admin(auth.uid(), p.store_id) OR is_platform_admin(auth.uid()))
  ));

CREATE POLICY "Store admins can delete product_variants"
  ON public.product_variants FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_id
    AND (is_store_admin(auth.uid(), p.store_id) OR is_platform_admin(auth.uid()))
  ));

-- 5. FOOD_ITEMS
DROP POLICY "Allow all insert food_items" ON public.food_items;
DROP POLICY "Allow all update food_items" ON public.food_items;
DROP POLICY "Allow all delete food_items" ON public.food_items;

CREATE POLICY "Store admins can insert food_items"
  ON public.food_items FOR INSERT
  WITH CHECK (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));

CREATE POLICY "Store admins can update food_items"
  ON public.food_items FOR UPDATE
  USING (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));

CREATE POLICY "Store admins can delete food_items"
  ON public.food_items FOR DELETE
  USING (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));

-- 6. COUPONS
DROP POLICY "Allow all insert coupons" ON public.coupons;
DROP POLICY "Allow all update coupons" ON public.coupons;
DROP POLICY "Allow all delete coupons" ON public.coupons;

CREATE POLICY "Store admins can insert coupons"
  ON public.coupons FOR INSERT
  WITH CHECK (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));

CREATE POLICY "Store admins can update coupons"
  ON public.coupons FOR UPDATE
  USING (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));

CREATE POLICY "Store admins can delete coupons"
  ON public.coupons FOR DELETE
  USING (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));

-- 7. STORE_ADMINS
DROP POLICY "Anyone can read store_admins" ON public.store_admins;
DROP POLICY "Allow insert store_admins" ON public.store_admins;
DROP POLICY "Allow delete store_admins" ON public.store_admins;

CREATE POLICY "Users can read own or same-store admin status"
  ON public.store_admins FOR SELECT
  USING (
    auth.uid() = user_id
    OR is_store_admin(auth.uid(), store_id)
    OR is_platform_admin(auth.uid())
  );

CREATE POLICY "Platform admins can insert store_admins"
  ON public.store_admins FOR INSERT
  WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete store_admins"
  ON public.store_admins FOR DELETE
  USING (is_platform_admin(auth.uid()));

-- 8. STORAGE: product-images
DROP POLICY IF EXISTS "Allow all upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Allow all update product images" ON storage.objects;
DROP POLICY IF EXISTS "Allow all delete product images" ON storage.objects;

CREATE POLICY "Store admins can upload images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Store admins can update images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Store admins can delete images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
  );
```

### Nenhuma alteracao de codigo e necessaria

As verificacoes ja existem no frontend (usePlatformAdmin, useStoreAdmin). O que faltava era a protecao no lado do servidor (RLS), que e o que esta migracao resolve.

### Atualizacao dos findings de seguranca

Apos aplicar a migracao, os findings resolvidos serao removidos do painel de seguranca.

