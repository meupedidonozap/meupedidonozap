CREATE OR REPLACE FUNCTION public.has_invoice_seller_access(_user_id uuid, _store_id uuid, _seller_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT NULLIF(btrim(_seller_code), '') IS NOT NULL AND EXISTS (
 SELECT 1 FROM public.store_users su CROSS JOIN LATERAL unnest(su.seller_codes) c
 WHERE su.user_id=_user_id AND su.store_id=_store_id AND su.is_active AND su.role IN ('vendedor','televendas')
 AND COALESCE(NULLIF(ltrim(btrim(c),'0'),''),'0')=COALESCE(NULLIF(ltrim(btrim(_seller_code),'0'),''),'0') AND NULLIF(btrim(c),'') IS NOT NULL);
$$;
REVOKE ALL ON FUNCTION public.has_invoice_seller_access(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_invoice_seller_access(uuid,uuid,text) TO authenticated,service_role;
ALTER POLICY "Invoices visible through customer portfolio" ON public.customer_invoices USING (
 CASE WHEN EXISTS (SELECT 1 FROM public.stores s WHERE s.id=store_id AND s.slug='dicolore')
 THEN public.has_invoice_seller_access(auth.uid(),store_id,vendedor_codigo)
 ELSE (store_id,cliente_codigo) IN (SELECT k.store_id,k.customer_code FROM public.portfolio_customer_keys(auth.uid()) k) END);
CREATE OR REPLACE FUNCTION public.can_read_erp_item(_user_id uuid,_store_id uuid,_order_key text,_item_customer text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH identity AS (
 SELECT COALESCE((SELECT NULLIF(btrim(o.cliente_codigo),'') FROM public.erp_orders o WHERE o.store_id=_store_id AND o.external_key=_order_key LIMIT 1),NULLIF(btrim(_item_customer),'')) AS customer_code
 )
 SELECT public.is_platform_admin(_user_id) OR public.is_store_admin(_user_id,_store_id)
 OR EXISTS (SELECT 1 FROM identity i WHERE public.has_customer_portfolio_access(_user_id,_store_id,i.customer_code)
 OR EXISTS (SELECT 1 FROM public.customer_profiles cp WHERE cp.user_id=_user_id AND cp.store_id=_store_id AND NULLIF(btrim(cp.customer_code),'')=i.customer_code))
 OR EXISTS (SELECT 1 FROM public.customer_invoices nf JOIN public.stores s ON s.id=nf.store_id
 WHERE nf.store_id=_store_id AND s.slug='dicolore' AND nf.pedido_codigo NOT IN ('','0')
 AND (COALESCE(NULLIF(nf.filial_codigo,''),'1')||'|'||nf.pedido_codigo)=_order_key
 AND public.has_invoice_seller_access(_user_id,_store_id,nf.vendedor_codigo));
$$;
REVOKE ALL ON FUNCTION public.can_read_erp_item(uuid,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_erp_item(uuid,uuid,text,text) TO authenticated,service_role;
ALTER POLICY "ERP order items visible through customer portfolio" ON public.erp_order_items USING (public.can_read_erp_item(auth.uid(),store_id,order_key,cliente_codigo));
ALTER POLICY "ERP order items visible to own customer" ON public.erp_order_items USING (public.can_read_erp_item(auth.uid(),store_id,order_key,cliente_codigo));
CREATE OR REPLACE FUNCTION public.align_erp_item_customer() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE header_customer text;
BEGIN
 SELECT NULLIF(btrim(o.cliente_codigo),'') INTO header_customer FROM public.erp_orders o WHERE o.store_id=NEW.store_id AND o.external_key=NEW.order_key LIMIT 1;
 IF header_customer IS NOT NULL THEN NEW.cliente_codigo=header_customer; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER align_erp_item_customer BEFORE INSERT OR UPDATE OF cliente_codigo,order_key ON public.erp_order_items FOR EACH ROW EXECUTE FUNCTION public.align_erp_item_customer();