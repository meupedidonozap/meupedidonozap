ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS customer_profile_id uuid;
ALTER TABLE public.push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_kind_check;
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_kind_check CHECK (kind IN ('seller','admin','customer'));
CREATE INDEX IF NOT EXISTS idx_push_subs_customer ON public.push_subscriptions (customer_profile_id) WHERE is_active;

CREATE TABLE IF NOT EXISTS public.financial_notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  title_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('due_soon','overdue')),
  sent_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (title_id, kind, sent_on)
);
GRANT ALL ON public.financial_notification_log TO service_role;
ALTER TABLE public.financial_notification_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.upsert_customer_push_subscription(p_store_id uuid, p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_user uuid := auth.uid(); v_cp uuid; v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_endpoint IS NULL OR length(btrim(p_endpoint)) = 0 THEN RAISE EXCEPTION 'endpoint required'; END IF;
  SELECT id INTO v_cp FROM public.customer_profiles WHERE store_id = p_store_id AND user_id = v_user LIMIT 1;
  IF v_cp IS NULL THEN RAISE EXCEPTION 'no customer profile'; END IF;
  UPDATE public.push_subscriptions SET store_id=p_store_id, seller_id=NULL, kind='customer', customer_profile_id=v_cp,
    user_id=v_user, p256dh=p_p256dh, auth=p_auth, user_agent=COALESCE(p_user_agent,user_agent), is_active=true, last_used_at=now()
   WHERE endpoint=p_endpoint RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  INSERT INTO public.push_subscriptions (store_id, kind, customer_profile_id, user_id, endpoint, p256dh, auth, user_agent, is_active)
  VALUES (p_store_id,'customer',v_cp,v_user,p_endpoint,p_p256dh,p_auth,p_user_agent,true) RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.upsert_customer_push_subscription(uuid,text,text,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.upsert_customer_push_subscription(uuid,text,text,text,text) TO authenticated;
