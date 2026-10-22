ALTER TABLE public.customer_profiles ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved';

CREATE OR REPLACE FUNCTION public.guard_customer_self_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  req boolean;
  privileged boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF; -- service/back-office routines
  privileged := public.is_store_admin(auth.uid(), NEW.store_id)
    OR public.is_platform_admin(auth.uid())
    OR public.has_store_permission(auth.uid(), NEW.store_id, 'can_view_customers');
  IF privileged THEN RETURN NEW; END IF;
  SELECT COALESCE((settings->>'requireLoginToBrowse')::boolean, false) INTO req FROM public.stores WHERE id = NEW.store_id;
  IF TG_OP = 'INSERT' THEN
    IF req THEN
      NEW.approval_status := 'pending';
      NEW.is_active := false;
      NEW.seller_code := '';
    ELSE
      NEW.approval_status := 'approved';
    END IF;
  ELSE
    NEW.approval_status := OLD.approval_status;
    NEW.is_active := OLD.is_active;
    NEW.seller_code := OLD.seller_code;
    NEW.price_table := OLD.price_table;
    NEW.customer_code := OLD.customer_code;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_customer_self_approval ON public.customer_profiles;
CREATE TRIGGER trg_guard_customer_self_approval
BEFORE INSERT OR UPDATE ON public.customer_profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_customer_self_approval();