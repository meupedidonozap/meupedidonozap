
-- 1) push_subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  user_id uuid,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_seller ON public.push_subscriptions(seller_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_store ON public.push_subscriptions(store_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own push subscriptions"
  ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR is_store_admin(auth.uid(), store_id));

CREATE POLICY "Users read own push subscriptions"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));

CREATE POLICY "Users update own push subscriptions"
  ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR is_store_admin(auth.uid(), store_id));

CREATE POLICY "Users delete own push subscriptions"
  ON public.push_subscriptions FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR is_store_admin(auth.uid(), store_id));

-- 2) Habilitar pg_net (idempotente)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 3) Trigger function que chama a edge function quando entra pedido pendente
CREATE OR REPLACE FUNCTION public.notify_new_pending_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text := 'https://buvhdqpbpbwpzidzmdqh.supabase.co/functions/v1/notify-new-order';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1dmhkcXBicGJ3cHppZHptZHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MjkxNjAsImV4cCI6MjA4NjMwNTE2MH0.-9GJg347r5JKvbRwNTd2RnOmIgi99KTN1xMl46WJ6mg';
BEGIN
  IF NEW.status IN ('pendente','pending') THEN
    PERFORM extensions.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'apikey', v_anon,
        'Authorization','Bearer '||v_anon
      ),
      body := jsonb_build_object('order_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_pending_order ON public.orders;
CREATE TRIGGER trg_notify_new_pending_order
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_pending_order();
