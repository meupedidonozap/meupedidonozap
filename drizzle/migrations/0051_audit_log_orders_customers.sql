CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  entity text NOT NULL,
  entity_id uuid NOT NULL,
  ref_label text NOT NULL DEFAULT '',
  customer_name text NOT NULL DEFAULT '',
  customer_code text NOT NULL DEFAULT '',
  seller_name text NOT NULL DEFAULT '',
  action text NOT NULL,
  actor_id uuid,
  actor_name text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_store_idx ON public.audit_log(store_id, entity, created_at DESC);
CREATE INDEX audit_log_entity_idx ON public.audit_log(entity_id);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store admins read audit log" ON public.audit_log FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.is_store_admin(auth.uid(), store_id));

CREATE OR REPLACE FUNCTION public.audit_actor_name(_store uuid, _uid uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE
    WHEN _uid IS NULL THEN 'Sistema / ERP'
    ELSE coalesce(
      (SELECT nullif(name,'') || ' (' || role || ')' FROM store_users WHERE store_id=_store AND user_id=_uid LIMIT 1),
      (SELECT 'Administrador' WHERE is_platform_admin(_uid) OR is_store_admin(_uid,_store)),
      (SELECT nullif(name,'') || ' (cliente)' FROM customer_profiles WHERE store_id=_store AND user_id=_uid LIMIT 1),
      'Usuário')
  END $$;

CREATE OR REPLACE FUNCTION public.audit_order_changes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.orders%ROWTYPE; act text; det jsonb := '{}'::jsonb; uid uuid := auth.uid();
  qn numeric; qo numeric;
BEGIN
  IF TG_OP='DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  SELECT coalesce(sum((i->>'quantity')::numeric),0) INTO qn FROM jsonb_array_elements(coalesce(r.items,'[]'::jsonb)) i;
  IF TG_OP='INSERT' THEN
    act := 'criacao';
    det := jsonb_build_object('status',r.status,'itens',jsonb_array_length(coalesce(r.items,'[]'::jsonb)),'quantidade',qn,'total',r.total,'origem',r.origem);
  ELSIF TG_OP='DELETE' THEN
    act := 'exclusao';
    det := jsonb_build_object('status',r.status,'itens',jsonb_array_length(coalesce(r.items,'[]'::jsonb)),'quantidade',qn,'total',r.total);
  ELSE
    IF NEW.items IS NOT DISTINCT FROM OLD.items AND NEW.total IS NOT DISTINCT FROM OLD.total
       AND NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.erp_order_code IS NOT DISTINCT FROM OLD.erp_order_code
       AND (NEW.customer->>'name') IS NOT DISTINCT FROM (OLD.customer->>'name') THEN RETURN NEW; END IF;
    SELECT coalesce(sum((i->>'quantity')::numeric),0) INTO qo FROM jsonb_array_elements(coalesce(OLD.items,'[]'::jsonb)) i;
    IF NEW.status='cancelado' AND OLD.status<>'cancelado' THEN act:='cancelamento';
    ELSIF NEW.status IS DISTINCT FROM OLD.status AND OLD.status='orcamento' THEN act:='finalizacao';
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN act:='status';
    ELSIF NEW.erp_order_code IS DISTINCT FROM OLD.erp_order_code THEN act:='integracao_erp';
    ELSE act:='edicao'; END IF;
    det := jsonb_build_object(
      'status_de',OLD.status,'status_para',NEW.status,
      'itens_de',jsonb_array_length(coalesce(OLD.items,'[]'::jsonb)),'itens_para',jsonb_array_length(coalesce(NEW.items,'[]'::jsonb)),
      'quantidade_de',qo,'quantidade_para',qn,'total_de',OLD.total,'total_para',NEW.total,
      'cliente_de',OLD.customer->>'name','cliente_para',NEW.customer->>'name','erp',NEW.erp_order_code);
  END IF;
  INSERT INTO audit_log(store_id,entity,entity_id,ref_label,customer_name,customer_code,seller_name,action,actor_id,actor_name,details)
  VALUES (r.store_id,'order',r.id,'#'||r.order_number,coalesce(r.customer->>'name',''),
    coalesce(r.customer->>'customerCode',''),
    coalesce(nullif(r.customer->>'claimedName',''),nullif(r.customer->>'sellerName',''),nullif(r.customer->>'createdByName',''),''),
    act,uid,audit_actor_name(r.store_id,uid),det);
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zz_audit_orders ON public.orders;
CREATE TRIGGER zz_audit_orders AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.audit_order_changes();

CREATE OR REPLACE FUNCTION public.audit_customer_changes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.customer_profiles%ROWTYPE; act text; det jsonb := '{}'::jsonb; uid uuid := auth.uid();
BEGIN
  IF TG_OP='DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  IF TG_OP='INSERT' THEN act:='criacao';
    det := jsonb_build_object('tabela',r.price_table,'codigo',r.customer_code,'vendedor',r.seller_code,'status',r.approval_status);
  ELSIF TG_OP='DELETE' THEN act:='exclusao';
  ELSE
    IF NEW.price_table IS DISTINCT FROM OLD.price_table THEN act:='tabela';
      det := jsonb_build_object('de',OLD.price_table,'para',NEW.price_table);
    ELSIF NEW.customer_code IS DISTINCT FROM OLD.customer_code OR NEW.erp_sent_at IS DISTINCT FROM OLD.erp_sent_at OR NEW.erp_error IS DISTINCT FROM OLD.erp_error THEN act:='integracao_erp';
      det := jsonb_build_object('codigo_de',OLD.customer_code,'codigo_para',NEW.customer_code,'enviado_em',NEW.erp_sent_at,'erro',NEW.erp_error);
    ELSIF NEW.seller_code IS DISTINCT FROM OLD.seller_code THEN act:='vendedor';
      det := jsonb_build_object('de',OLD.seller_code,'para',NEW.seller_code);
    ELSIF NEW.approval_status IS DISTINCT FROM OLD.approval_status OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN act:='status';
      det := jsonb_build_object('aprovacao_de',OLD.approval_status,'aprovacao_para',NEW.approval_status,'ativo_de',OLD.is_active,'ativo_para',NEW.is_active);
    ELSIF NEW.no_discount IS DISTINCT FROM OLD.no_discount THEN act:='desconto';
      det := jsonb_build_object('sem_desconto',NEW.no_discount);
    ELSE RETURN NEW; END IF;
  END IF;
  INSERT INTO audit_log(store_id,entity,entity_id,ref_label,customer_name,customer_code,seller_name,action,actor_id,actor_name,details)
  VALUES (r.store_id,'customer',r.id,coalesce(nullif(r.customer_code,''),'PROSPECT'),r.name,coalesce(r.customer_code,''),coalesce(r.seller_code,''),act,uid,audit_actor_name(r.store_id,uid),det);
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zz_audit_customers ON public.customer_profiles;
CREATE TRIGGER zz_audit_customers AFTER INSERT OR UPDATE OR DELETE ON public.customer_profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_customer_changes();

REVOKE ALL ON FUNCTION public.audit_actor_name(uuid,uuid) FROM PUBLIC, anon;