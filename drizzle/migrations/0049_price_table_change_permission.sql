ALTER TABLE public.store_users ADD COLUMN IF NOT EXISTS can_change_price_table boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.can_change_order_price_table(_user_id uuid, _store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_platform_admin(_user_id) OR public.is_store_admin(_user_id,_store_id)
    OR EXISTS(SELECT 1 FROM public.store_users WHERE user_id=_user_id AND store_id=_store_id AND is_active AND can_change_price_table)
$$;

CREATE OR REPLACE FUNCTION public.guard_store_user_price_table_permission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF (TG_OP='INSERT' AND NEW.can_change_price_table) OR (TG_OP='UPDATE' AND NEW.can_change_price_table IS DISTINCT FROM OLD.can_change_price_table) THEN
    IF NOT (public.is_platform_admin(auth.uid()) OR public.is_store_admin(auth.uid(),NEW.store_id)) THEN
      RAISE EXCEPTION 'Somente administradores podem conceder a permissão de alterar tabela de preço.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_store_user_price_table_permission ON public.store_users;
CREATE TRIGGER guard_store_user_price_table_permission BEFORE INSERT OR UPDATE ON public.store_users
FOR EACH ROW EXECUTE FUNCTION public.guard_store_user_price_table_permission();

CREATE OR REPLACE FUNCTION public.recalculate_customer_order(p_order_id uuid, p_items jsonb, p_discount numeric, p_table integer)
 RETURNS orders LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE o public.orders%ROWTYPE; sub numeric; cp public.customer_profiles%ROWTYPE; cur integer;
BEGIN
 SELECT * INTO o FROM orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM stores WHERE id=o.store_id AND slug='dicolore') THEN RAISE EXCEPTION 'Recálculo disponível apenas na DiColore.'; END IF;
 IF NOT (is_platform_admin(auth.uid()) OR is_store_admin(auth.uid(),o.store_id) OR has_store_permission(auth.uid(),o.store_id,'can_manage_orders')) THEN RAISE EXCEPTION 'Sem permissão para recalcular este pedido.'; END IF;
 IF o.status NOT IN ('orcamento','pendente') OR o.xml_downloaded_at IS NOT NULL OR o.erp_sent_at IS NOT NULL OR coalesce(o.erp_order_code,'')<>'' THEN RAISE EXCEPTION 'Somente orçamentos e pendentes não transmitidos podem ser recalculados.'; END IF;
 IF p_table NOT IN (1,3,4,8,9,11) THEN RAISE EXCEPTION 'Tabela de preço inválida.'; END IF;
 SELECT * INTO cp FROM customer_profiles WHERE store_id=o.store_id AND customer_code=trim(o.customer->>'customerCode') AND customer_code<>'' ORDER BY no_discount DESC,(user_id IS NULL) DESC,created_at LIMIT 1;
 IF NOT FOUND THEN SELECT * INTO cp FROM customer_profiles WHERE store_id=o.store_id AND user_id=o.user_id LIMIT 1; END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cadastro do cliente não encontrado.'; END IF;
 cur := CASE WHEN (o.customer->>'priceTable') ~ '^\d+$' THEN (o.customer->>'priceTable')::int ELSE coalesce(cp.price_table,4) END;
 IF p_table <> coalesce(cp.price_table,4) AND p_table <> cur AND NOT can_change_order_price_table(auth.uid(),o.store_id) THEN
   RAISE EXCEPTION 'Você não tem permissão para alterar a tabela de preço do pedido.';
 END IF;
 SELECT coalesce(sum((value->>'price')::numeric*(value->>'quantity')::numeric),0) INTO sub FROM jsonb_array_elements(p_items);
 UPDATE orders SET items=p_items,customer=o.customer || jsonb_build_object('noDiscount',cp.no_discount,'priceTable',p_table),subtotal=round(sub,2),discount=greatest(0,p_discount),total=round(greatest(0,sub-p_discount)+delivery_fee,2) WHERE id=o.id RETURNING * INTO o;
 RETURN o;
END $function$;

CREATE OR REPLACE FUNCTION public.enforce_customer_discount_policy()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE cp public.customer_profiles%ROWTYPE; code text; blocked boolean; it jsonb; prod public.products%ROWTYPE; variant public.product_variants%ROWTYPE; price numeric; tab integer; req text; next_items jsonb := '[]'; sub numeric := 0;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM stores WHERE id=NEW.store_id AND slug='dicolore') THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.items IS NOT DISTINCT FROM OLD.items AND NEW.customer IS NOT DISTINCT FROM OLD.customer AND NEW.discount IS NOT DISTINCT FROM OLD.discount AND NEW.total IS NOT DISTINCT FROM OLD.total AND NEW.subtotal IS NOT DISTINCT FROM OLD.subtotal AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF OLD.status NOT IN ('orcamento','pendente') THEN RETURN NEW; END IF;
 END IF;
 code := trim(coalesce(NEW.customer->>'customerCode',''));
 IF code<>'' THEN
  SELECT * INTO cp FROM customer_profiles WHERE store_id=NEW.store_id AND customer_code=code ORDER BY no_discount DESC, (user_id IS NULL) DESC, created_at LIMIT 1;
 ELSE
  SELECT * INTO cp FROM customer_profiles WHERE store_id=NEW.store_id AND ((NEW.user_id IS NOT NULL AND user_id=NEW.user_id) OR (regexp_replace(cpf_cnpj,'\D','','g')=regexp_replace(NEW.customer->>'cpfCnpj','\D','','g') AND coalesce(NEW.customer->>'cpfCnpj','')<>'')) ORDER BY no_discount DESC, created_at LIMIT 1;
 END IF;
 blocked := coalesce(cp.no_discount,false);
 NEW.customer := NEW.customer || jsonb_build_object('noDiscount',blocked);
 IF NOT blocked THEN RETURN NEW; END IF;
 tab := coalesce(cp.price_table,4);
 req := NEW.customer->>'priceTable';
 IF req IN ('1','3','4','8','9','11') AND req::int<>tab AND public.can_change_order_price_table(auth.uid(),NEW.store_id) THEN tab := req::int; END IF;
 FOR it IN SELECT value FROM jsonb_array_elements(NEW.items) LOOP
  SELECT * INTO prod FROM products WHERE store_id=NEW.store_id AND id::text=it->>'productId';
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado para recalcular o preço da tabela.'; END IF;
  IF coalesce(it->>'variantId','')<>'' THEN
   SELECT * INTO variant FROM product_variants WHERE product_id=prod.id AND id::text=it->>'variantId';
   IF NOT FOUND THEN RAISE EXCEPTION 'Variação não encontrada.'; END IF;
   price := CASE tab WHEN 1 THEN variant.price_table_1 WHEN 3 THEN variant.price_table_3 WHEN 8 THEN variant.price_table_8 WHEN 9 THEN variant.price_table_9 WHEN 11 THEN variant.price_table_11 ELSE coalesce(variant.price_table_4,variant.price) END;
  ELSE
   price := CASE tab WHEN 1 THEN prod.price_table_1 WHEN 3 THEN prod.price_table_3 WHEN 8 THEN prod.price_table_8 WHEN 9 THEN prod.price_table_9 WHEN 11 THEN prod.price_table_11 ELSE coalesce(prod.price_table_4,prod.base_price) END;
  END IF;
  IF price IS NULL OR price<=0 THEN RAISE EXCEPTION 'Item sem preço na tabela do cliente. Nenhum recálculo foi salvo.'; END IF;
  next_items := next_items || jsonb_build_array(it || jsonb_build_object('price',price,'discountPercent',0));
  sub := sub + price * (it->>'quantity')::numeric;
 END LOOP;
 NEW.items := next_items; NEW.subtotal := round(sub,2); NEW.discount := 0; NEW.total := round(sub+NEW.delivery_fee,2);
 NEW.customer := NEW.customer || jsonb_build_object('priceTable',tab);
 RETURN NEW;
END $function$;