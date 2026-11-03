CREATE OR REPLACE FUNCTION public.sync_order_status_from_erp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE target text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stores s WHERE s.id=NEW.store_id AND s.slug IN ('dicolore','dicoloresenses')) THEN RETURN NEW; END IF;
  IF upper(coalesce(NEW.status,''))='C' THEN RETURN NEW; END IF;
  target := CASE
    WHEN NEW.nota_fiscal_numero IS NOT NULL OR upper(NEW.status)='F' THEN 'entregue'
    WHEN NEW.ordem_faturamento IS NOT NULL OR upper(NEW.status)='S' THEN 'preparando'
    ELSE 'confirmado' END;
  UPDATE public.orders o SET status=target
   WHERE o.store_id=NEW.store_id
     AND o.status NOT IN ('cancelado','orcamento') AND o.status IS DISTINCT FROM target
     AND o.erp_order_code IS NOT NULL
     AND (o.erp_order_code IN (NEW.codigo_importacao, NEW.codigo) OR o.order_number::text = NEW.codigo_importacao);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_order_status_from_erp ON public.erp_orders;
CREATE TRIGGER trg_sync_order_status_from_erp AFTER INSERT OR UPDATE ON public.erp_orders
FOR EACH ROW EXECUTE FUNCTION public.sync_order_status_from_erp();