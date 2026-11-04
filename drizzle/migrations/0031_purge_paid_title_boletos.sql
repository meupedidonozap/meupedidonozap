CREATE OR REPLACE FUNCTION public.purge_boleto_when_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF upper(coalesce(NEW.status,'')) = 'PAGO' THEN
    DELETE FROM public.customer_title_boletos WHERE title_id = NEW.id;
    NEW.has_boleto := false;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_purge_boleto_when_paid
BEFORE INSERT OR UPDATE OF status ON public.customer_titles
FOR EACH ROW EXECUTE FUNCTION public.purge_boleto_when_paid();

CREATE OR REPLACE FUNCTION public.block_boleto_for_paid_title()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.customer_titles t WHERE t.id = NEW.title_id AND upper(t.status) = 'PAGO') THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_block_boleto_for_paid_title
BEFORE INSERT OR UPDATE ON public.customer_title_boletos
FOR EACH ROW EXECUTE FUNCTION public.block_boleto_for_paid_title();