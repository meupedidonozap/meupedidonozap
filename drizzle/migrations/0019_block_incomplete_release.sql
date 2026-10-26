CREATE OR REPLACE FUNCTION public.block_incomplete_release()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_slug text;
BEGIN
  IF NEW.status = 'liberado_transmissao' AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT slug INTO v_slug FROM public.stores WHERE id = NEW.store_id;
    IF v_slug IN ('dicolore','dicoloresenses') THEN
      IF coalesce(trim(NEW.customer->>'paymentFormaCodigo'),'') = '' OR coalesce(trim(NEW.customer->>'paymentCondicaoCodigo'),'') = '' THEN
        RAISE EXCEPTION 'Pedido incompleto: informe forma e condição de pagamento antes de liberar para transmissão';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_block_incomplete_release ON public.orders;
CREATE TRIGGER trg_block_incomplete_release BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.block_incomplete_release();