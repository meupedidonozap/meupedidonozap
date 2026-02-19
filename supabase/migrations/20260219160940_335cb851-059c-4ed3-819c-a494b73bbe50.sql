
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
    WHERE p.id = product_images.product_id
    AND (is_store_admin(auth.uid(), p.store_id) OR is_platform_admin(auth.uid()))
  ));

CREATE POLICY "Store admins can update product_images"
  ON public.product_images FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_images.product_id
    AND (is_store_admin(auth.uid(), p.store_id) OR is_platform_admin(auth.uid()))
  ));

CREATE POLICY "Store admins can delete product_images"
  ON public.product_images FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_images.product_id
    AND (is_store_admin(auth.uid(), p.store_id) OR is_platform_admin(auth.uid()))
  ));
