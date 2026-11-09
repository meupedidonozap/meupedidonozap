CREATE OR REPLACE FUNCTION public.can_manage_product_images(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    public.is_platform_admin(_user_id)
    OR EXISTS (SELECT 1 FROM public.store_admins WHERE user_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.store_users WHERE user_id = _user_id AND is_active AND can_manage_products)
  )
$$;

DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete product images" ON storage.objects;

CREATE POLICY "Public read product images" ON storage.objects
FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "Admins can upload product images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images' AND public.can_manage_product_images(auth.uid()));

CREATE POLICY "Admins can update product images" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND public.can_manage_product_images(auth.uid()))
WITH CHECK (bucket_id = 'product-images' AND public.can_manage_product_images(auth.uid()));

CREATE POLICY "Admins can delete product images" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND public.can_manage_product_images(auth.uid()));