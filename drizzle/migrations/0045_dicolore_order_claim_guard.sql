CREATE OR REPLACE FUNCTION public.dicolore_order_claim_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _slug text;
  _su record;
  _old_role text := NEW.customer IS NOT NULL AND OLD.customer->>'claimedRole' IS NOT NULL;
  _same boolean;
BEGIN
  IF _uid IS NULL THEN RETURN NEW; END IF;
  SELECT slug INTO _slug FROM stores WHERE id = NEW.store_id;
  IF _slug IS DISTINCT FROM 'dicolore' THEN RETURN NEW; END IF;
  IF is_platform_admin(_uid) OR is_store_admin(_uid, NEW.store_id) THEN RETURN NEW; END IF;

  -- Ninguém (fora admin) apaga ou troca o "assumido por" já gravado.
  IF OLD.customer->>'claimedRole' IS NOT NULL AND (
       NEW.customer->>'claimedRole' IS DISTINCT FROM OLD.customer->>'claimedRole'
    OR NEW.customer->>'claimedName' IS DISTINCT FROM OLD.customer->>'claimedName'
    OR NEW.customer->>'claimedErpCode' IS DISTINCT FROM OLD.customer->>'claimedErpCode') THEN
    RAISE EXCEPTION 'Este pedido já foi assumido por %.', OLD.customer->>'claimedName';
  END IF;

  IF OLD.customer->>'claimedRole' IS NULL THEN RETURN NEW; END IF;
  -- O próprio cliente segue com as regras dele (trigger de status).
  IF OLD.user_id = _uid THEN RETURN NEW; END IF;

  SELECT role, name, erp_code INTO _su FROM store_users
   WHERE store_id = NEW.store_id AND user_id = _uid AND is_active LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF OLD.customer->>'claimedRole' = 'televendas' THEN
    _same := _su.role = 'televendas' AND (
      (coalesce(OLD.customer->>'claimedErpCode','') <> '' AND coalesce(_su.erp_code,'') <> '' AND trim(OLD.customer->>'claimedErpCode') = trim(_su.erp_code))
      OR ((coalesce(OLD.customer->>'claimedErpCode','') = '' OR coalesce(_su.erp_code,'') = '') AND lower(trim(OLD.customer->>'claimedName')) = lower(trim(_su.name))));
  ELSE
    _same := _su.role <> 'televendas' AND lower(trim(OLD.customer->>'claimedName')) = lower(trim(_su.name));
  END IF;

  IF NOT _same THEN
    RAISE EXCEPTION 'Este pedido já foi assumido por %.', OLD.customer->>'claimedName';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS dicolore_order_claim_guard ON public.orders;
CREATE TRIGGER dicolore_order_claim_guard BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.dicolore_order_claim_guard();