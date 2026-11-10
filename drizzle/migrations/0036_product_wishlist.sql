CREATE TABLE public.product_wishlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name text NOT NULL DEFAULT '',
  product_code text NOT NULL DEFAULT '',
  customer_name text NOT NULL DEFAULT '',
  email text,
  whatsapp text,
  user_id uuid,
  customer_profile_id uuid,
  push_notified_at timestamptz,
  whatsapp_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_wishlist_store ON public.product_wishlist(store_id, created_at DESC);
CREATE INDEX idx_product_wishlist_product ON public.product_wishlist(product_id) WHERE push_notified_at IS NULL;

GRANT INSERT ON public.product_wishlist TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_wishlist TO authenticated;
GRANT ALL ON public.product_wishlist TO service_role;
ALTER TABLE public.product_wishlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can request restock alert" ON public.product_wishlist FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.products p JOIN public.stores s ON s.id = p.store_id
          WHERE p.id = product_id AND p.store_id = store_id AND s.is_active)
  AND (coalesce(btrim(email),'') <> '' OR coalesce(btrim(whatsapp),'') <> '')
  AND (user_id IS NULL OR user_id = auth.uid())
  AND push_notified_at IS NULL AND whatsapp_sent_at IS NULL
);
CREATE POLICY "Store staff view wishlist" ON public.product_wishlist FOR SELECT TO authenticated
USING (public.is_store_admin(auth.uid(), store_id) OR public.is_platform_admin(auth.uid()) OR public.has_store_permission(auth.uid(), store_id, 'can_view_customers'));
CREATE POLICY "Store staff update wishlist" ON public.product_wishlist FOR UPDATE TO authenticated
USING (public.is_store_admin(auth.uid(), store_id) OR public.is_platform_admin(auth.uid()) OR public.has_store_permission(auth.uid(), store_id, 'can_view_customers'))
WITH CHECK (public.is_store_admin(auth.uid(), store_id) OR public.is_platform_admin(auth.uid()) OR public.has_store_permission(auth.uid(), store_id, 'can_view_customers'));
CREATE POLICY "Store admins delete wishlist" ON public.product_wishlist FOR DELETE TO authenticated
USING (public.is_store_admin(auth.uid(), store_id) OR public.is_platform_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.notify_wishlist_restock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions','net' AS $$
DECLARE
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1dmhkcXBicGJ3cHppZHptZHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MjkxNjAsImV4cCI6MjA4NjMwNTE2MH0.-9GJg347r5JKvbRwNTd2RnOmIgi99KTN1xMl46WJ6mg';
BEGIN
  IF coalesce(OLD.stock,0) <= 0 AND coalesce(NEW.stock,0) > 0 AND NEW.is_active
     AND EXISTS (SELECT 1 FROM public.product_wishlist w WHERE w.product_id = NEW.id AND w.push_notified_at IS NULL) THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://buvhdqpbpbwpzidzmdqh.supabase.co/functions/v1/notify-wishlist',
        body := jsonb_build_object('product_id', NEW.id),
        headers := jsonb_build_object('Content-Type','application/json','apikey',v_anon,'Authorization','Bearer '||v_anon));
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'notify_wishlist_restock falhou: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_wishlist_restock AFTER UPDATE OF stock ON public.products
FOR EACH ROW EXECUTE FUNCTION public.notify_wishlist_restock();