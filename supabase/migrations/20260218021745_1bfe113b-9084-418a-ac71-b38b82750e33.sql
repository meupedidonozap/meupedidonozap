
-- Drop overly permissive storage policies
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete images" ON storage.objects;

-- Restrict to store/platform admins only
CREATE POLICY "Admins can upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images'
    AND (
      EXISTS (SELECT 1 FROM public.store_admins WHERE user_id = auth.uid())
      OR public.is_platform_admin(auth.uid())
    )
  );

CREATE POLICY "Admins can update product images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product-images'
    AND (
      EXISTS (SELECT 1 FROM public.store_admins WHERE user_id = auth.uid())
      OR public.is_platform_admin(auth.uid())
    )
  );

CREATE POLICY "Admins can delete product images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-images'
    AND (
      EXISTS (SELECT 1 FROM public.store_admins WHERE user_id = auth.uid())
      OR public.is_platform_admin(auth.uid())
    )
  );
