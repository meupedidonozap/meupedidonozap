ALTER TABLE public.cleaning_quotes ADD COLUMN created_by uuid DEFAULT auth.uid();
CREATE UNIQUE INDEX cleaning_quote_actor_key ON public.cleaning_quotes(store_id,created_by,client_key);
CREATE OR REPLACE FUNCTION public.cleaning_ledger_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF auth.uid() IS NOT NULL AND NOT public.cleaning_admin(NEW.store_id) AND current_setting('mpz.cleaning_internal',true) IS DISTINCT FROM 'yes' THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
IF TG_OP='INSERT' AND auth.uid() IS NOT NULL AND (NEW.quote_id IS NOT NULL OR NEW.purchase_id IS NOT NULL) AND current_setting('mpz.cleaning_internal',true) IS DISTINCT FROM 'yes' THEN RAISE EXCEPTION 'Contas vinculadas são geradas pelo atendimento ou compra.'; END IF;
IF TG_OP='UPDATE' THEN IF NEW.store_id<>OLD.store_id OR NEW.kind<>OLD.kind OR NEW.quote_id IS DISTINCT FROM OLD.quote_id OR NEW.purchase_id IS DISTINCT FROM OLD.purchase_id THEN RAISE EXCEPTION 'Identidade da conta protegida.'; END IF;
IF OLD.paid_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Conta já paga; registro preservado.'; END IF;
IF (OLD.quote_id IS NOT NULL OR OLD.purchase_id IS NOT NULL) AND (NEW.amount<>OLD.amount OR NEW.description<>OLD.description OR NEW.party<>OLD.party) THEN RAISE EXCEPTION 'Valores vinculados protegidos.'; END IF;
END IF;
IF NEW.paid_at IS NOT NULL AND trim(NEW.payment_method)='' THEN RAISE EXCEPTION 'Informe a forma de pagamento.'; END IF;
IF NEW.quote_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.cleaning_quotes WHERE id=NEW.quote_id AND store_id=NEW.store_id) THEN RAISE EXCEPTION 'Orçamento de outra loja.'; END IF;
IF NEW.purchase_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.cleaning_purchases WHERE id=NEW.purchase_id AND store_id=NEW.store_id) THEN RAISE EXCEPTION 'Compra de outra loja.'; END IF;
RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.cleaning_accept_quote(p_id uuid,p_expected_total numeric) RETURNS public.cleaning_quotes LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q public.cleaning_quotes; o public.orders; so public.service_orders; order_items jsonb; line_total numeric; BEGIN
SELECT * INTO q FROM public.cleaning_quotes WHERE id=p_id FOR UPDATE;
IF NOT FOUND OR auth.uid() IS NULL OR (q.user_id<>auth.uid() AND NOT public.cleaning_admin(q.store_id)) THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
IF q.status='aceito' THEN RETURN q; END IF;
IF q.status<>'pronto' OR q.total IS NULL OR q.total IS DISTINCT FROM p_expected_total THEN RAISE EXCEPTION 'Orçamento mudou ou ainda aguarda preço. Atualize antes de aceitar.'; END IF;
SELECT coalesce(jsonb_agg(jsonb_build_object('productId',v->>'productId','name',v->>'name','code',v->>'code','quantity',coalesce((v->>'area')::numeric,1),'price',CASE WHEN v ? 'area' THEN coalesce((v->>'unit_price')::numeric,0) ELSE coalesce((v->>'total')::numeric,0) END)),'[]'::jsonb),coalesce(sum((v->>'total')::numeric),0) INTO order_items,line_total FROM jsonb_array_elements(q.items||q.addons) v;
IF line_total IS DISTINCT FROM q.total OR EXISTS(SELECT 1 FROM jsonb_array_elements(q.items||q.addons) v WHERE (v->>'total') IS NULL) THEN order_items:=jsonb_build_array(jsonb_build_object('name','Serviços do orçamento #'||q.number,'code','ORC-'||q.number,'quantity',1,'price',q.total,'description',(SELECT string_agg(v->>'name'||' · '||v->>'area'||' m²',' / ') FROM jsonb_array_elements(q.items) v))); END IF;
INSERT INTO public.orders(store_id,user_id,customer,items,subtotal,discount,delivery_fee,total,status,payment_method,delivery_shift,observations) VALUES(q.store_id,q.user_id,q.customer,order_items,q.total,0,0,q.total,'orcamento','a_combinar','',q.notes) RETURNING * INTO o;
INSERT INTO public.service_orders(store_id,order_id,user_id,os_number,customer,items,extra_items,subtotal,discount,total,status,observations) VALUES(q.store_id,o.id,q.user_id,o.order_number,q.customer,order_items,'[]',q.total,0,q.total,'aberta',q.notes) RETURNING * INTO so;
UPDATE public.cleaning_quotes SET status='aceito',accepted_at=now(),order_id=o.id,service_order_id=so.id WHERE id=p_id RETURNING * INTO q;
PERFORM set_config('mpz.cleaning_internal','yes',true);
INSERT INTO public.cleaning_ledger(store_id,kind,description,party,amount,due_date,quote_id) VALUES(q.store_id,'receivable','Orçamento #'||q.number,q.customer->>'name',q.total,(now() AT TIME ZONE 'America/Sao_Paulo')::date,q.id);
RETURN q; END $$;
CREATE FUNCTION public.cleaning_quote_submission_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
IF NEW.details->>'height' IS NULL OR NEW.details->>'access' IS NULL OR (NEW.details->>'height')::numeric NOT BETWEEN 0 AND 100 OR NEW.details->>'access' NOT IN ('facil','restrito') OR jsonb_typeof(NEW.details->'water') IS DISTINCT FROM 'boolean' OR jsonb_typeof(NEW.details->'electricity') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Dados do local inválidos.'; END IF;
RETURN NEW; END $$;
CREATE TRIGGER cleaning_quote_submission_guard BEFORE INSERT ON public.cleaning_quotes FOR EACH ROW EXECUTE FUNCTION public.cleaning_quote_submission_guard();