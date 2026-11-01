CREATE OR REPLACE FUNCTION public.order_reserves_stock(_status text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$ SELECT coalesce(_status,'') IN ('pendente','pending','confirmado','preparando','liberado_transmissao') $$;

CREATE OR REPLACE FUNCTION public.store_tracks_stock(_store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.stores s WHERE s.id=_store_id AND (
  coalesce((s.settings->>'useStockIntegration')::boolean,false) OR coalesce((s.settings->>'useBlingIntegration')::boolean,false) OR s.slug='jewosnewborn')) $$;

CREATE OR REPLACE FUNCTION public.apply_order_stock(_store_id uuid, _items jsonb, _sign integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE it jsonb; q integer; pid uuid; vid uuid;
BEGIN
  IF jsonb_typeof(_items) <> 'array' THEN RETURN; END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    q := coalesce(nullif(it->>'quantity','')::numeric,0)::integer;
    IF q <= 0 THEN CONTINUE; END IF;
    BEGIN pid := nullif(it->>'productId','')::uuid; EXCEPTION WHEN OTHERS THEN pid := NULL; END;
    BEGIN vid := nullif(it->>'variantId','')::uuid; EXCEPTION WHEN OTHERS THEN vid := NULL; END;
    IF pid IS NULL THEN CONTINUE; END IF;
    IF vid IS NOT NULL THEN
      UPDATE public.product_variants SET stock = stock - _sign*q WHERE id=vid AND product_id=pid;
    END IF;
    UPDATE public.products SET stock = stock - _sign*q WHERE id=pid AND store_id=_store_id;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.orders_stock_reservation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.store_tracks_stock(NEW.store_id) THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN
    IF public.order_reserves_stock(NEW.status) OR NEW.status IN ('enviado','entregue') THEN PERFORM public.apply_order_stock(NEW.store_id, NEW.items, 1); END IF;
    RETURN NEW;
  END IF;
  IF OLD.status IS NOT DISTINCT FROM NEW.status AND OLD.items IS NOT DISTINCT FROM NEW.items THEN RETURN NEW; END IF;
  -- "baixado" = qualquer status exceto orçamento/cancelado
  IF OLD.status NOT IN ('orcamento','cancelado') THEN PERFORM public.apply_order_stock(OLD.store_id, OLD.items, -1); END IF;
  IF NEW.status NOT IN ('orcamento','cancelado') THEN PERFORM public.apply_order_stock(NEW.store_id, NEW.items, 1); END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_orders_stock_reservation ON public.orders;
CREATE TRIGGER trg_orders_stock_reservation AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_stock_reservation();

-- Quantidades reservadas por pedidos em aberto (ainda não despachados), para o Bling descontar do saldo.
CREATE OR REPLACE FUNCTION public.store_reserved_stock(_store_id uuid)
RETURNS TABLE(product_id uuid, variant_id uuid, qty integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT nullif(it->>'productId','')::uuid, nullif(it->>'variantId','')::uuid, sum(coalesce(nullif(it->>'quantity','')::numeric,0))::integer
  FROM public.orders o CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(o.items)='array' THEN o.items ELSE '[]'::jsonb END) it
  WHERE o.store_id=_store_id AND public.order_reserves_stock(o.status)
    AND (it->>'productId') ~ '^[0-9a-f-]{36}$' AND coalesce(it->>'variantId','') ~ '^([0-9a-f-]{36})?$'
  GROUP BY 1,2 $$;
REVOKE EXECUTE ON FUNCTION public.store_reserved_stock(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_order_stock(uuid, jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_reserved_stock(uuid) TO service_role;