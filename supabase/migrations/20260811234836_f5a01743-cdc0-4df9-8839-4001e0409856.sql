ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_kit boolean NOT NULL DEFAULT false;

CREATE TABLE public.product_kit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  component_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_kit_items_kit ON public.product_kit_items(kit_product_id);

GRANT SELECT ON public.product_kit_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_kit_items TO authenticated;
GRANT ALL ON public.product_kit_items TO service_role;

ALTER TABLE public.product_kit_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kit items are viewable by everyone"
ON public.product_kit_items FOR SELECT
USING (true);

CREATE POLICY "Store managers can manage kit items"
ON public.product_kit_items FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.id = product_kit_items.kit_product_id
    AND (public.is_store_admin(auth.uid(), p.store_id)
      OR public.is_platform_admin(auth.uid())
      OR public.has_store_permission(auth.uid(), p.store_id, 'can_manage_products'))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.id = product_kit_items.kit_product_id
    AND (public.is_store_admin(auth.uid(), p.store_id)
      OR public.is_platform_admin(auth.uid())
      OR public.has_store_permission(auth.uid(), p.store_id, 'can_manage_products'))
));

CREATE TRIGGER trg_product_kit_items_updated
BEFORE UPDATE ON public.product_kit_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();