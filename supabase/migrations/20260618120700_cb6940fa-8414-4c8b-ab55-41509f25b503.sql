-- Permite upsert seguro de push_subscriptions por endpoint, contornando a RLS
-- quando o mesmo aparelho (endpoint) já estava cadastrado para outro usuário.
CREATE OR REPLACE FUNCTION public.upsert_push_subscription(
  p_store_id uuid,
  p_seller_id uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_endpoint IS NULL OR length(btrim(p_endpoint)) = 0 THEN
    RAISE EXCEPTION 'endpoint required';
  END IF;

  -- Tenta atualizar inscrição existente pelo endpoint (aparelho/navegador)
  UPDATE public.push_subscriptions
     SET store_id    = p_store_id,
         seller_id   = p_seller_id,
         user_id     = v_user,
         p256dh      = p_p256dh,
         auth        = p_auth,
         user_agent  = COALESCE(p_user_agent, user_agent),
         is_active   = true,
         last_used_at= now()
   WHERE endpoint = p_endpoint
   RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- Caso contrário, cria nova inscrição (novo aparelho)
  INSERT INTO public.push_subscriptions
    (store_id, seller_id, user_id, endpoint, p256dh, auth, user_agent, is_active)
  VALUES
    (p_store_id, p_seller_id, v_user, p_endpoint, p_p256dh, p_auth, p_user_agent, true)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_push_subscription(uuid, uuid, text, text, text, text) TO authenticated;