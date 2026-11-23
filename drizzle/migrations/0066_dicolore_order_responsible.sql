CREATE OR REPLACE FUNCTION public.dicolore_order_claim_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $function$
DECLARE _uid uuid := auth.uid(); _slug text; _su record; _same boolean;
BEGIN
 IF _uid IS NULL THEN RETURN NEW; END IF;
 SELECT slug INTO _slug FROM stores WHERE id=NEW.store_id;
 IF _slug IS DISTINCT FROM 'dicolore' THEN RETURN NEW; END IF;
 IF is_platform_admin(_uid) OR is_store_admin(_uid,NEW.store_id) OR is_store_manager(_uid,NEW.store_id) THEN RETURN NEW; END IF;
 IF OLD.customer->>'claimedRole' IS NOT NULL AND (
 NEW.customer->>'claimedRole' IS DISTINCT FROM OLD.customer->>'claimedRole' OR NEW.customer->>'claimedName' IS DISTINCT FROM OLD.customer->>'claimedName' OR NEW.customer->>'claimedErpCode' IS DISTINCT FROM OLD.customer->>'claimedErpCode') THEN
 RAISE EXCEPTION 'Este pedido já foi assumido por %.',OLD.customer->>'claimedName'; END IF;
 IF OLD.customer->>'claimedRole' IS NULL THEN RETURN NEW; END IF;
 IF OLD.user_id=_uid THEN RETURN NEW; END IF;
 SELECT role,name,erp_code INTO _su FROM store_users WHERE store_id=NEW.store_id AND user_id=_uid AND is_active LIMIT 1;
 IF NOT FOUND THEN RETURN NEW; END IF;
 IF OLD.customer->>'claimedRole'='televendas' THEN
 _same := _su.role='televendas' AND ((coalesce(OLD.customer->>'claimedErpCode','')<>'' AND coalesce(_su.erp_code,'')<>'' AND trim(OLD.customer->>'claimedErpCode')=trim(_su.erp_code)) OR ((coalesce(OLD.customer->>'claimedErpCode','')='' OR coalesce(_su.erp_code,'')='') AND lower(trim(OLD.customer->>'claimedName'))=lower(trim(_su.name))));
 ELSE _same := _su.role<>'televendas' AND lower(trim(OLD.customer->>'claimedName'))=lower(trim(_su.name)); END IF;
 IF NOT _same THEN RAISE EXCEPTION 'Este pedido já foi assumido por %.',OLD.customer->>'claimedName'; END IF;
 RETURN NEW;
END $function$;
CREATE OR REPLACE FUNCTION public.set_dicolore_order_responsible(p_order_id uuid,p_store_user_id uuid,p_expected_customer jsonb)
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $function$
DECLARE actor uuid:=auth.uid(); o public.orders%ROWTYPE; target public.store_users%ROWTYPE; c jsonb; previous jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Faça login para alterar o responsável.'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id=o.store_id AND slug='dicolore') OR NOT (public.is_platform_admin(actor) OR public.is_store_admin(actor,o.store_id) OR public.is_store_manager(actor,o.store_id)) THEN
 RAISE EXCEPTION 'Somente administrador ou gerente da DiColore pode alterar o responsável.'; END IF;
 IF o.status NOT IN ('pendente','orcamento') OR o.xml_downloaded_at IS NOT NULL OR o.erp_sent_at IS NOT NULL OR nullif(o.erp_order_code,'') IS NOT NULL THEN
 RAISE EXCEPTION 'Só é possível alterar o responsável antes da transmissão, em pedido Pendente ou Orçamento.'; END IF;
 IF o.customer IS DISTINCT FROM p_expected_customer THEN RAISE EXCEPTION 'O pedido foi alterado. Feche e abra a edição novamente.'; END IF;
 previous:=o.customer;
 c:=o.customer - ARRAY['claimedRole','claimedName','claimedErpCode','claimedAt','ownerRole','ownerName','isTelevendas','televendasName','televendasErpCode'];
 IF p_store_user_id IS NOT NULL THEN
 SELECT * INTO target FROM public.store_users WHERE id=p_store_user_id AND store_id=o.store_id AND is_active AND role IN ('vendedor','televendas');
 IF NOT FOUND THEN RAISE EXCEPTION 'Escolha um vendedor ou televendas ativo desta loja.'; END IF;
 c:=c || jsonb_build_object('claimedRole',target.role,'claimedName',target.name,'claimedAt',now(),'ownerRole',target.role,'ownerName',target.name);
 IF target.role='televendas' THEN c:=c || jsonb_build_object('claimedErpCode',target.erp_code,'isTelevendas',true,'televendasName',target.name,'televendasErpCode',target.erp_code); END IF;
 ELSE
 IF NOT (o.customer->>'createdByRole'='cliente' OR (o.origem='web' AND o.user_id IS NOT NULL AND NOT (o.customer ? 'createdByRole'))) THEN
 RAISE EXCEPTION 'Desvincular está disponível para pedidos criados pelo cliente.'; END IF;
 END IF;
 UPDATE public.orders SET customer=c WHERE id=o.id RETURNING * INTO o;
 INSERT INTO public.audit_log(store_id,entity,entity_id,ref_label,customer_name,customer_code,seller_name,action,actor_id,actor_name,details)
 VALUES(o.store_id,'order',o.id,'#'||o.order_number,coalesce(c->>'name',''),coalesce(c->>'customerCode',''),coalesce(c->>'claimedName',''),'edicao',actor,public.audit_actor_name(o.store_id,actor),jsonb_build_object('tipo','responsavel','responsavel_de',previous->>'claimedName','responsavel_para',c->>'claimedName','papel_de',previous->>'claimedRole','papel_para',c->>'claimedRole'));
 RETURN o;
END $function$;
REVOKE ALL ON FUNCTION public.set_dicolore_order_responsible(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_dicolore_order_responsible(uuid,uuid,jsonb) TO authenticated;