
DROP POLICY IF EXISTS "Admins can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete product images" ON storage.objects;

CREATE POLICY "Admins can upload product images" ON storage.objects
FOR INSERT TO public
WITH CHECK (
  bucket_id = 'product-images' AND (
    EXISTS (SELECT 1 FROM public.store_admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.store_users WHERE user_id = auth.uid() AND is_active AND can_manage_products)
    OR public.is_platform_admin(auth.uid())
  )
);

CREATE POLICY "Admins can update product images" ON storage.objects
FOR UPDATE TO public
USING (
  bucket_id = 'product-images' AND (
    EXISTS (SELECT 1 FROM public.store_admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.store_users WHERE user_id = auth.uid() AND is_active AND can_manage_products)
    OR public.is_platform_admin(auth.uid())
  )
);

CREATE POLICY "Admins can delete product images" ON storage.objects
FOR DELETE TO public
USING (
  bucket_id = 'product-images' AND (
    EXISTS (SELECT 1 FROM public.store_admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.store_users WHERE user_id = auth.uid() AND is_active AND can_manage_products)
    OR public.is_platform_admin(auth.uid())
  )
);
