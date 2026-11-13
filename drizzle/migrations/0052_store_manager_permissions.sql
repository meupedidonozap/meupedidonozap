ALTER TABLE public.store_users
  ADD COLUMN IF NOT EXISTS can_manage_categories boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_atendimento boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_discounts boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_discounts boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_customers boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_wishlist boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_technical_materials boolean NOT NULL DEFAULT false;

ALTER TABLE public.store_users DROP CONSTRAINT IF EXISTS store_users_role_check;
ALTER TABLE public.store_users ADD CONSTRAINT store_users_role_check CHECK (role = ANY (ARRAY['auxiliar','vendedor','televendas','gerente']));

CREATE POLICY "Store users with product permission write products" ON public.products FOR ALL TO authenticated
USING (public.has_store_permission(auth.uid(), store_id, 'can_manage_products'))
WITH CHECK (public.has_store_permission(auth.uid(), store_id, 'can_manage_products'));

CREATE POLICY "Store users with category permission write categories" ON public.categories FOR ALL TO authenticated
USING (public.has_store_permission(auth.uid(), store_id, 'can_manage_categories'))
WITH CHECK (public.has_store_permission(auth.uid(), store_id, 'can_manage_categories'));

CREATE POLICY "Store users with material permission write materials" ON public.technical_materials FOR ALL TO authenticated
USING (public.has_store_permission(auth.uid(), store_id, 'can_manage_technical_materials'))
WITH CHECK (public.has_store_permission(auth.uid(), store_id, 'can_manage_technical_materials'));

CREATE OR REPLACE FUNCTION public.update_store_group_discount_rules(p_store_id uuid, p_rules jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_settings jsonb;
BEGIN
  IF NOT public.has_store_permission(auth.uid(), p_store_id, 'can_manage_discounts') THEN
    RAISE EXCEPTION 'Sem permissão para alterar descontos';
  END IF;
  IF jsonb_typeof(p_rules) <> 'array' THEN RAISE EXCEPTION 'Regras inválidas'; END IF;
  SELECT settings INTO v_settings FROM public.stores WHERE id = p_store_id FOR UPDATE;
  UPDATE public.stores SET settings = jsonb_set(COALESCE(v_settings,'{}'::jsonb), '{discountRules}',
    COALESCE((SELECT jsonb_agg(r) FROM jsonb_array_elements(COALESCE(v_settings->'discountRules','[]'::jsonb)) r WHERE r->>'type' IS DISTINCT FROM 'group'), '[]'::jsonb)
    || COALESCE((SELECT jsonb_agg(r) FROM jsonb_array_elements(p_rules) r WHERE r->>'type' = 'group'), '[]'::jsonb))
  WHERE id = p_store_id;
END $$;
REVOKE ALL ON FUNCTION public.update_store_group_discount_rules(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_store_group_discount_rules(uuid, jsonb) TO authenticated;