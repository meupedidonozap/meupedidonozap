CREATE OR REPLACE FUNCTION public.dicolore_access_targets(p_codes text[] DEFAULT NULL, p_limit integer DEFAULT 100)
RETURNS TABLE (profile_id uuid, store_id uuid, customer_code text, existing_account_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT cp.id, cp.store_id, btrim(cp.customer_code), u.id
  FROM public.customer_profiles cp
  JOIN public.stores s ON s.id = cp.store_id AND s.slug = 'dicolore'
  LEFT JOIN auth.users u ON lower(u.email) = btrim(cp.customer_code) || '@dicolore.cliente.local'
  WHERE cp.user_id IS NULL
    AND btrim(cp.customer_code) ~ '^[0-9]+$'
    AND (p_codes IS NULL OR btrim(cp.customer_code) = ANY(p_codes))
  ORDER BY cp.is_active DESC, cp.created_at DESC, cp.id
  LIMIT greatest(1, least(coalesce(p_limit, 100), 5000));
$$;
REVOKE ALL ON FUNCTION public.dicolore_access_targets(text[], integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dicolore_access_targets(text[], integer) TO service_role;

CREATE OR REPLACE FUNCTION public.link_dicolore_customer_access(p_profile_id uuid, p_customer_code text, p_account_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_profile public.customer_profiles%ROWTYPE;
BEGIN
  SELECT cp.* INTO v_profile
  FROM public.customer_profiles cp JOIN public.stores s ON s.id = cp.store_id
  WHERE cp.id = p_profile_id AND s.slug = 'dicolore'
    AND btrim(cp.customer_code) = p_customer_code AND p_customer_code ~ '^[0-9]+$'
  FOR UPDATE OF cp;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cadastro DiColore não encontrado'; END IF;
  IF v_profile.user_id IS NOT NULL THEN
    RETURN v_profile.user_id = p_account_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_account_id
      AND lower(u.email) = p_customer_code || '@dicolore.cliente.local'
      AND u.email_confirmed_at IS NOT NULL)
    OR EXISTS (SELECT 1 FROM public.customer_profiles cp WHERE cp.user_id = p_account_id AND cp.id <> p_profile_id)
    OR EXISTS (SELECT 1 FROM public.platform_admins a WHERE a.user_id = p_account_id)
    OR EXISTS (SELECT 1 FROM public.store_admins a WHERE a.user_id = p_account_id)
    OR EXISTS (SELECT 1 FROM public.store_users a WHERE a.user_id = p_account_id)
  THEN RAISE EXCEPTION 'Conta incompatível com o cadastro'; END IF;
  UPDATE public.customer_profiles SET user_id = p_account_id WHERE id = p_profile_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.link_dicolore_customer_access(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_dicolore_customer_access(uuid, text, uuid) TO service_role;