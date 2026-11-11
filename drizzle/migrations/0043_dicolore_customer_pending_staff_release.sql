CREATE OR REPLACE FUNCTION public.dicolore_orders_staff_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE actor uuid := auth.uid(); authorized_staff boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = NEW.store_id AND slug = 'dicolore') THEN RETURN NEW; END IF;
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF actor IS NULL THEN RAISE EXCEPTION 'Faça login para finalizar seu pedido na DiColore.'; END IF;
  authorized_staff := public.is_platform_admin(actor)
    OR public.is_store_admin(actor, NEW.store_id)
    OR public.has_store_permission(actor, NEW.store_id, 'can_manage_orders')
    OR EXISTS (SELECT 1 FROM public.store_users WHERE user_id = actor AND store_id = NEW.store_id AND is_active AND role IN ('vendedor', 'televendas'));
  IF authorized_staff THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id IS DISTINCT FROM actor THEN RAISE EXCEPTION 'O pedido deve pertencer ao cliente autenticado.'; END IF;
    IF NEW.status NOT IN ('pendente', 'orcamento') OR NEW.status IS NULL THEN
      RAISE EXCEPTION 'O cliente finaliza como Pendente. Somente vendedor, televendas ou administrador pode liberar para transmissão após análise.';
    END IF;
  ELSE
    IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.store_id IS DISTINCT FROM OLD.store_id THEN
      RAISE EXCEPTION 'O cliente não pode alterar a titularidade do pedido.';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND (NEW.status NOT IN ('pendente', 'orcamento') OR NEW.status IS NULL) THEN
      RAISE EXCEPTION 'Somente vendedor, televendas ou administrador pode alterar o status para liberar para transmissão após análise.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_dicolore_orders_staff_only ON public.orders;
CREATE TRIGGER trg_dicolore_orders_staff_only BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.dicolore_orders_staff_only();