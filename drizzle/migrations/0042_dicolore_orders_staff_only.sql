CREATE OR REPLACE FUNCTION public.dicolore_orders_staff_only()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.stores s WHERE s.id = NEW.store_id AND s.slug = 'dicolore')
     AND NOT public.has_any_store_access(auth.uid(), NEW.store_id) THEN
    RAISE EXCEPTION 'Na DiColore o pedido é finalizado somente pelo vendedor, televendas ou administrador.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_dicolore_orders_staff_only ON public.orders;
CREATE TRIGGER trg_dicolore_orders_staff_only BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.dicolore_orders_staff_only();