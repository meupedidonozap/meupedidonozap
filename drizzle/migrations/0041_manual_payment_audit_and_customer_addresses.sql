ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_manual_record jsonb;

CREATE OR REPLACE FUNCTION public.record_manual_order_payment(p_order_id uuid, p_method text, p_note text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders%ROWTYPE; actor uuid := auth.uid(); actor_name text;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Faça login novamente.'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
 IF NOT (public.is_platform_admin(actor) OR public.is_store_admin(actor,o.store_id) OR public.has_store_permission(actor,o.store_id,'can_manage_orders')) THEN RAISE EXCEPTION 'Sem permissão para registrar pagamentos.'; END IF;
 IF o.payment_status='paid' THEN RAISE EXCEPTION 'Este pedido já está pago.'; END IF;
 IF o.status='cancelado' OR o.payment_status IN ('refunded','canceled') THEN RAISE EXCEPTION 'Pedido cancelado ou estornado: crie um novo pedido antes de receber.'; END IF;
 IF p_method NOT IN ('pix','dinheiro','cartao_maquininha','transferencia','boleto') THEN RAISE EXCEPTION 'Forma de recebimento inválida.'; END IF;
 IF length(coalesce(p_note,''))>1000 THEN RAISE EXCEPTION 'Observação deve ter até 1000 caracteres.'; END IF;
 SELECT coalesce(nullif(name,''),'Administrador') INTO actor_name FROM public.store_users WHERE user_id=actor AND store_id=o.store_id LIMIT 1;
 UPDATE public.orders SET payment_status='paid', paid_at=now(), payment_environment='manual', payment_method=p_method, payment_error=NULL,
 payment_manual_record=jsonb_build_object('confirmed_by',actor,'confirmed_name',coalesce(actor_name,'Administrador'),'confirmed_at',now(),'method',p_method,'note',coalesce(p_note,''),'previous_method',o.payment_method,'previous_status',o.payment_status,'previous_error',o.payment_error)
 WHERE id=p_order_id;
 RETURN jsonb_build_object('id',p_order_id,'payment_status','paid');
END; $$;
REVOKE ALL ON FUNCTION public.record_manual_order_payment(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_manual_order_payment(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_order_payment_confirmation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.role()='service_role' OR auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF (TG_OP='INSERT' AND (NEW.payment_status='paid' OR NEW.payment_manual_record IS NOT NULL)) OR (TG_OP='UPDATE' AND (NEW.payment_status IS DISTINCT FROM OLD.payment_status AND (NEW.payment_status='paid' OR OLD.payment_status='paid') OR NEW.payment_manual_record IS DISTINCT FROM OLD.payment_manual_record OR NEW.paid_at IS DISTINCT FROM OLD.paid_at)) THEN
  IF NOT (public.is_platform_admin(auth.uid()) OR public.is_store_admin(auth.uid(),NEW.store_id) OR public.has_store_permission(auth.uid(),NEW.store_id,'can_manage_orders')) THEN RAISE EXCEPTION 'Somente a equipe autorizada pode confirmar pagamentos.'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER guard_order_payment_confirmation BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_order_payment_confirmation();

CREATE TABLE public.customer_addresses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
 user_id uuid NOT NULL, label text NOT NULL DEFAULT 'Endereço', cep text NOT NULL, uf text NOT NULL, city text NOT NULL,
 neighborhood text NOT NULL, address text NOT NULL, number text NOT NULL, complement text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.customer_addresses TO authenticated;
GRANT ALL ON public.customer_addresses TO service_role;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_customer_addresses ON public.customer_addresses FOR ALL TO authenticated USING (user_id=auth.uid() AND NOT public.mpz_managed_customer_store(store_id)) WITH CHECK (user_id=auth.uid() AND NOT public.mpz_managed_customer_store(store_id));
CREATE OR REPLACE FUNCTION public.validate_customer_address() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF length(btrim(NEW.label)) NOT BETWEEN 1 AND 80 OR regexp_replace(NEW.cep,'[^0-9]','','g') !~ '^[0-9]{8}$' OR NEW.uf NOT IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') OR length(btrim(NEW.city)) NOT BETWEEN 1 AND 150 OR length(btrim(NEW.neighborhood)) NOT BETWEEN 1 AND 150 OR length(btrim(NEW.address)) NOT BETWEEN 1 AND 250 OR length(btrim(NEW.number)) NOT BETWEEN 1 AND 30 OR length(NEW.complement)>250 THEN RAISE EXCEPTION 'Informe um endereço completo e válido.'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER validate_customer_address BEFORE INSERT OR UPDATE ON public.customer_addresses FOR EACH ROW EXECUTE FUNCTION public.validate_customer_address();