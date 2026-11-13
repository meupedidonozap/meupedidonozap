CREATE OR REPLACE FUNCTION public.confirm_external_order_customer(p_order_id uuid, p_profile_id uuid, p_order_code text, p_customer_code text DEFAULT NULL, p_error text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders%ROWTYPE; c public.customer_profiles%ROWTYPE; st public.stores%ROWTYPE; target_code text; doc text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Integrador não autorizado'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
 SELECT * INTO st FROM public.stores WHERE id=o.store_id FOR SHARE;
 IF st.slug IS DISTINCT FROM 'dicolore' OR st.settings->'useExternalIntegrator' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Integrador externo desativado'; END IF;
 IF o.erp_sent_at IS NOT NULL THEN
   IF o.erp_order_code = trim(p_order_code) THEN RETURN jsonb_build_object('updated',o.id,'already_confirmed',true); END IF;
   RAISE EXCEPTION 'Pedido já confirmado com outro código';
 END IF;
 IF o.status IS DISTINCT FROM 'liberado_transmissao' THEN RAISE EXCEPTION 'Pedido não liberado para transmissão'; END IF;
 IF p_error IS NOT NULL AND p_order_code IS NULL THEN
   IF length(p_error)>1000 THEN RAISE EXCEPTION 'Erro inválido'; END IF;
   UPDATE public.orders SET erp_error=p_error WHERE id=o.id;
   RETURN jsonb_build_object('updated',o.id);
 END IF;
 IF p_order_code IS NULL OR trim(p_order_code) !~ '^[0-9]{1,50}$' THEN RAISE EXCEPTION 'Código ERP do pedido inválido'; END IF;
 SELECT * INTO c FROM public.customer_profiles WHERE id=p_profile_id AND store_id=o.store_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cadastro do cliente não encontrado'; END IF;
 doc := regexp_replace(coalesce(o.customer->>'cpfCnpj',''),'\D','','g');
 IF coalesce(trim(o.customer->>'customerCode'),'') <> '' THEN
   IF trim(o.customer->>'customerCode') IS DISTINCT FROM trim(c.customer_code) THEN RAISE EXCEPTION 'Cadastro não corresponde ao código do pedido'; END IF;
 ELSE
   IF length(doc) NOT IN (11,14) OR doc IS DISTINCT FROM regexp_replace(c.cpf_cnpj,'\D','','g') THEN RAISE EXCEPTION 'Cadastro não corresponde ao documento do pedido'; END IF;
 END IF;
 target_code := coalesce(nullif(trim(p_customer_code),''),nullif(trim(c.customer_code),''));
 IF target_code IS NULL OR target_code !~ '^[0-9]{1,30}$' THEN RAISE EXCEPTION 'Informe cliente_codigo_erp para cliente novo'; END IF;
 IF coalesce(trim(c.customer_code),'') <> '' AND trim(c.customer_code) <> target_code THEN RAISE EXCEPTION 'Cliente já cadastrado com outro código ERP'; END IF;
 -- Serialize claims of the same store/customer code before checking for duplicates.
 PERFORM pg_advisory_xact_lock(hashtextextended(o.store_id::text || ':' || target_code,0));
 IF EXISTS (SELECT 1 FROM public.customer_profiles WHERE store_id=o.store_id AND customer_code=target_code AND id<>c.id) THEN RAISE EXCEPTION 'Código ERP já usado por outro cadastro'; END IF;
 IF coalesce(trim(c.customer_code),'') = '' THEN
   UPDATE public.customer_profiles SET customer_code=target_code,erp_sent_at=now(),erp_error=NULL,approval_status='approved',is_active=true WHERE id=c.id;
 END IF;
 UPDATE public.orders SET
   customer=CASE WHEN coalesce(trim(customer->>'customerCode'),'')=target_code THEN customer ELSE jsonb_set(customer,'{customerCode}',to_jsonb(target_code)) END,
   erp_order_code=trim(p_order_code),erp_sent_at=now(),erp_error=NULL,xml_downloaded_at=now(),status='confirmado'
 WHERE id=o.id;
 RETURN jsonb_build_object('updated',o.id,'cliente_id_mpz',c.id,'cliente_codigo_erp',target_code);
END $$;
REVOKE ALL ON FUNCTION public.confirm_external_order_customer(uuid,uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_external_order_customer(uuid,uuid,text,text,text) TO service_role;