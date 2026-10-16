CREATE TABLE public.technical_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  product_ids uuid[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.technical_materials TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.technical_materials TO authenticated;
GRANT ALL ON public.technical_materials TO service_role;
ALTER TABLE public.technical_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active materials" ON public.technical_materials FOR SELECT
  USING (is_active OR public.is_store_admin(auth.uid(), store_id) OR public.is_platform_admin(auth.uid()) OR public.has_store_permission(auth.uid(), store_id, 'can_manage_products'));
CREATE POLICY "Managers write materials" ON public.technical_materials FOR ALL TO authenticated
  USING (public.is_store_admin(auth.uid(), store_id) OR public.is_platform_admin(auth.uid()) OR public.has_store_permission(auth.uid(), store_id, 'can_manage_products'))
  WITH CHECK (public.is_store_admin(auth.uid(), store_id) OR public.is_platform_admin(auth.uid()) OR public.has_store_permission(auth.uid(), store_id, 'can_manage_products'));
CREATE INDEX ON public.technical_materials(store_id);
CREATE TRIGGER trg_technical_materials_updated BEFORE UPDATE ON public.technical_materials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();