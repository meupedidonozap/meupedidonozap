ALTER TABLE public.push_subscriptions ALTER COLUMN seller_id DROP NOT NULL;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'seller';
ALTER TABLE public.push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_kind_check;
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_kind_check CHECK (kind IN ('seller','admin'));
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_store_kind ON public.push_subscriptions (store_id, kind) WHERE is_active;

DROP POLICY IF EXISTS "push_owner_select" ON public.push_subscriptions;
CREATE POLICY "push_owner_select" ON public.push_subscriptions
FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "push_owner_update" ON public.push_subscriptions;
CREATE POLICY "push_owner_update" ON public.push_subscriptions
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.upsert_push_subscription(p_store_id uuid, p_seller_id uuid, p_endpoint text, p_p256dh text, p_auth text, p_user_agent text, p_kind text DEFAULT 'seller')
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF COALESCE(p_kind,'seller') NOT IN ('seller','admin') THEN
    RAISE EXCEPTION 'invalid kind';
  END IF;

  IF NOT public.has_any_store_access(v_user, p_store_id) THEN
    RAISE EXCEPTION 'no access to store';
  END IF;

  UPDATE public.push_subscriptions
     SET store_id    = p_store_id,
         seller_id   = p_seller_id,
         kind        = COALESCE(p_kind,'seller'),
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

  INSERT INTO public.push_subscriptions
    (store_id, seller_id, kind, user_id, endpoint, p256dh, auth, user_agent, is_active)
  VALUES
    (p_store_id, p_seller_id, COALESCE(p_kind,'seller'), v_user, p_endpoint, p_p256dh, p_auth, p_user_agent, true)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;