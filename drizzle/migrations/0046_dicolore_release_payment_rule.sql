CREATE OR REPLACE FUNCTION public.check_dicolore_release_payment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cfg jsonb;
BEGIN
  IF NEW.status IS DISTINCT FROM 'liberado_transmissao' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF; END IF;
  SELECT settings INTO cfg FROM public.stores WHERE id = NEW.store_id AND slug = 'dicolore';
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF COALESCE(cfg->'rules'->>'requireReleasePayment', 'true') <> 'false' AND
    (NULLIF(trim(NEW.customer->>'paymentFormaCodigo'), '') IS NULL OR NULLIF(trim(NEW.customer->>'paymentCondicaoCodigo'), '') IS NULL) THEN
    RAISE EXCEPTION 'Selecione a forma e a condição de pagamento antes de liberar para transmissão.';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER check_dicolore_release_payment BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.check_dicolore_release_payment();