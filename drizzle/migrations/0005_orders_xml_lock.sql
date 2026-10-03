ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS xml_downloaded_at timestamptz;

CREATE OR REPLACE FUNCTION public.block_edit_after_xml()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF OLD.xml_downloaded_at IS NOT NULL AND (
       NEW.items IS DISTINCT FROM OLD.items
    OR NEW.total IS DISTINCT FROM OLD.total
    OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
    OR NEW.discount IS DISTINCT FROM OLD.discount
    OR NEW.customer IS DISTINCT FROM OLD.customer
    OR NEW.observations IS DISTINCT FROM OLD.observations) THEN
    RAISE EXCEPTION 'Pedido bloqueado: o XML já foi baixado.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_block_edit_after_xml BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.block_edit_after_xml();