ALTER TABLE public.customer_profiles ADD COLUMN no_discount boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.guard_customer_discount_policy() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.role()='service_role' THEN RETURN NEW; END IF;
 IF (TG_OP='INSERT' AND NEW.no_discount) OR (TG_OP='UPDATE' AND NEW.no_discount IS DISTINCT FROM OLD.no_discount) THEN
  IF NOT (is_platform_admin(auth.uid()) OR is_store_admin(auth.uid(),NEW.store_id) OR has_store_permission(auth.uid(),NEW.store_id,'can_manage_orders')) THEN RAISE EXCEPTION 'Somente a equipe autorizada pode alterar a regra de desconto.'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_customer_discount_policy BEFORE INSERT OR UPDATE ON public.customer_profiles FOR EACH ROW EXECUTE FUNCTION public.guard_customer_discount_policy();
CREATE OR REPLACE FUNCTION public.enforce_customer_discount_policy() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cp public.customer_profiles%ROWTYPE; code text; blocked boolean; it jsonb; prod public.products%ROWTYPE; variant public.product_variants%ROWTYPE; price numeric; tab integer; next_items jsonb := '[]'; sub numeric := 0;
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
END $$;
CREATE TRIGGER zz_enforce_customer_discount_policy BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.enforce_customer_discount_policy();
CREATE OR REPLACE FUNCTION public.recalculate_customer_order(p_order_id uuid,p_items jsonb,p_discount numeric,p_table integer) RETURNS public.orders LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE o public.orders%ROWTYPE; sub numeric; cp public.customer_profiles%ROWTYPE;
BEGIN
 SELECT * INTO o FROM orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM stores WHERE id=o.store_id AND slug='dicolore') THEN RAISE EXCEPTION 'Recálculo disponível apenas na DiColore.'; END IF;
 IF NOT (is_platform_admin(auth.uid()) OR is_store_admin(auth.uid(),o.store_id) OR has_store_permission(auth.uid(),o.store_id,'can_manage_orders')) THEN RAISE EXCEPTION 'Sem permissão para recalcular este pedido.'; END IF;
 IF o.status NOT IN ('orcamento','pendente') OR o.xml_downloaded_at IS NOT NULL OR o.erp_sent_at IS NOT NULL OR coalesce(o.erp_order_code,'')<>'' THEN RAISE EXCEPTION 'Somente orçamentos e pendentes não transmitidos podem ser recalculados.'; END IF;
 SELECT * INTO cp FROM customer_profiles WHERE store_id=o.store_id AND customer_code=trim(o.customer->>'customerCode') AND customer_code<>'' ORDER BY no_discount DESC,(user_id IS NULL) DESC,created_at LIMIT 1;
 IF NOT FOUND THEN SELECT * INTO cp FROM customer_profiles WHERE store_id=o.store_id AND user_id=o.user_id LIMIT 1; END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cadastro do cliente não encontrado.'; END IF;
 IF coalesce(cp.price_table,4)<>p_table THEN RAISE EXCEPTION 'A tabela do cliente mudou. Reabra o pedido e recalcule.'; END IF;
 SELECT coalesce(sum((value->>'price')::numeric*(value->>'quantity')::numeric),0) INTO sub FROM jsonb_array_elements(p_items);
 UPDATE orders SET items=p_items,customer=o.customer || jsonb_build_object('noDiscount',cp.no_discount,'priceTable',p_table),subtotal=round(sub,2),discount=greatest(0,p_discount),total=round(greatest(0,sub-p_discount)+delivery_fee,2) WHERE id=o.id RETURNING * INTO o;
 RETURN o;
END $$;
REVOKE ALL ON FUNCTION public.recalculate_customer_order(uuid,jsonb,numeric,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.recalculate_customer_order(uuid,jsonb,numeric,integer) TO authenticated,service_role;