

# Correcao Completa de Seguranca

## Problemas Identificados

A migracao de RLS aprovada anteriormente nao foi executada. As politicas permissivas (`WITH CHECK (true)`) ainda estao ativas em todas as tabelas. Alem disso, existem outros problemas a resolver.

## Acoes a Executar

### 1. Migracao SQL - Restringir RLS (Prioridade Maxima)

Aplicar a migracao completa para substituir todas as politicas permissivas por politicas baseadas em roles. Esta e a mesma migracao aprovada anteriormente que nao foi executada:

- **stores**: INSERT somente platform admins, UPDATE para store/platform admins, DELETE somente platform admins
- **categories, products, food_items, coupons**: INSERT/UPDATE/DELETE somente store admins ou platform admins
- **product_variants**: INSERT/UPDATE/DELETE verificando via join com products
- **store_admins**: SELECT restrito, INSERT/DELETE somente platform admins
- **storage product-images**: INSERT/UPDATE/DELETE somente usuarios autenticados

### 2. Atualizar Security Findings Ja Resolvidos

Apos a migracao, remover/atualizar os findings que serao corrigidos:
- `stores_no_write_rls` - resolvido pela migracao
- `storage_unrestricted_upload` - resolvido pela migracao
- `store_admins_public_read` - resolvido pela migracao
- `admin_page_no_auth` - ja resolvido no codigo (AdminPage usa usePlatformAdmin)
- `admin_check_client_only` - resolvido pela migracao (RLS agora protege no servidor)
- Findings do supabase_lov (`store_admins_user_exposure`, `stores_contact_info_exposure`, `categories_unrestricted_write`)

### 3. Marcar Findings de Baixo Risco como Informativo

- `is_store_admin_definer` - ja esta correto, marcar como ignorado
- `admin_creation_enum` - risco baixo, dificil de corrigir sem edge function, aumentar dificuldade
- `coupon_no_server_validation` - marcar como dificuldade alta (requer edge function/RPC dedicada)
- `stores_contact_info_exposure` - informacao de contato e necessaria para clientes, marcar como aceitavel

### 4. Habilitar Leaked Password Protection

Configurar protecao contra senhas vazadas no auth.

## Resumo de Impacto

| Problema | Severidade | Acao |
|---|---|---|
| Politicas RLS permissivas (7 tabelas + storage) | Critica | Migracao SQL |
| AdminPage sem auth | Ja corrigido | Atualizar finding |
| SECURITY DEFINER seguro | Info | Ignorar |
| Validacao cupom client-side | Media | Marcar dificuldade alta |
| Enumeracao email admin | Baixa | Marcar dificuldade media |
| Leaked password protection | Media | Configurar auth |

## Detalhes Tecnicos

### SQL da Migracao

```text
-- 1. STORES
DROP POLICY IF EXISTS "Allow all insert stores" ON public.stores;
DROP POLICY IF EXISTS "Allow all update stores" ON public.stores;
DROP POLICY IF EXISTS "Allow all delete stores" ON public.stores;

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
DROP POLICY IF EXISTS "Allow all insert categories" ON public.categories;
DROP POLICY IF EXISTS "Allow all update categories" ON public.categories;
DROP POLICY IF EXISTS "Allow all delete categories" ON public.categories;

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
DROP POLICY IF EXISTS "Allow all insert products" ON public.products;
DROP POLICY IF EXISTS "Allow all update products" ON public.products;
DROP POLICY IF EXISTS "Allow all delete products" ON public.products;

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
DROP POLICY IF EXISTS "Allow all insert product_variants" ON public.product_variants;
DROP POLICY IF EXISTS "Allow all update product_variants" ON public.product_variants;
DROP POLICY IF EXISTS "Allow all delete product_variants" ON public.product_variants;

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
DROP POLICY IF EXISTS "Allow all insert food_items" ON public.food_items;
DROP POLICY IF EXISTS "Allow all update food_items" ON public.food_items;
DROP POLICY IF EXISTS "Allow all delete food_items" ON public.food_items;

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
DROP POLICY IF EXISTS "Allow all insert coupons" ON public.coupons;
DROP POLICY IF EXISTS "Allow all update coupons" ON public.coupons;
DROP POLICY IF EXISTS "Allow all delete coupons" ON public.coupons;

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
DROP POLICY IF EXISTS "Anyone can read store_admins" ON public.store_admins;
DROP POLICY IF EXISTS "Allow insert store_admins" ON public.store_admins;
DROP POLICY IF EXISTS "Allow delete store_admins" ON public.store_admins;

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

CREATE POLICY "Authenticated users can upload images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users can update images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users can delete images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
  );
```

### Nenhuma alteracao de codigo frontend necessaria

O AdminPage ja usa `usePlatformAdmin` e o StoreAdminPage ja usa `useStoreAdmin` para protecao no cliente. A migracao adiciona a protecao no servidor que estava faltando.

