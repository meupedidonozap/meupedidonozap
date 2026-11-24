CREATE OR REPLACE FUNCTION public.mpz_prospect_registration_error(c jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $function$
DECLARE key text; label text;
BEGIN
 IF length(trim(coalesce(c->>'name',''))) NOT BETWEEN 1 AND 200 THEN RETURN 'Informe o nome (máximo de 200 caracteres).'; END IF;
 IF nullif(trim(coalesce(c->>'cpfCnpj',c->>'cpf_cnpj','')),'') IS NOT NULL AND NOT public.mpz_valid_document(coalesce(c->>'cpfCnpj',c->>'cpf_cnpj')) THEN RETURN 'Informe um CPF/CNPJ válido.'; END IF;
 IF regexp_replace(coalesce(c->>'whatsapp',''),'[^0-9]','','g') !~ '^[1-9]{2}[0-9]{8,9}$' THEN RETURN 'Informe um telefone com DDD (10 ou 11 dígitos).'; END IF;
 IF regexp_replace(coalesce(c->>'cep',''),'[^0-9]','','g') !~ '^[0-9]{8}$' THEN RETURN 'Informe um CEP com 8 dígitos.'; END IF;
 IF coalesce(c->>'uf','') NOT IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') THEN RETURN 'Informe uma UF válida.'; END IF;
 FOREACH key IN ARRAY ARRAY['city','neighborhood','address','number'] LOOP
  label := CASE key WHEN 'city' THEN 'a cidade' WHEN 'neighborhood' THEN 'o bairro' WHEN 'address' THEN 'a rua' ELSE 'o número do endereço (ou S/N)' END;
  IF length(trim(coalesce(c->>key,''))) NOT BETWEEN 1 AND (CASE key WHEN 'address' THEN 250 WHEN 'number' THEN 30 ELSE 150 END) THEN RETURN 'Informe ' || label || '.'; END IF;
 END LOOP;
 RETURN NULL;
END $function$;
REVOKE ALL ON FUNCTION public.mpz_prospect_registration_error(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mpz_prospect_registration_error(jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mpz_validate_customer_write()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE c jsonb; message text; allow_prospect boolean := false;
BEGIN
 IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME = 'customer_profiles' THEN
  IF TG_OP = 'UPDATE' THEN
   IF ROW(NEW.store_id,NEW.customer_code,NEW.name,NEW.cpf_cnpj,NEW.whatsapp,NEW.cep,NEW.uf,NEW.city,NEW.neighborhood,NEW.address,NEW.number) IS NOT DISTINCT FROM ROW(OLD.store_id,OLD.customer_code,OLD.name,OLD.cpf_cnpj,OLD.whatsapp,OLD.cep,OLD.uf,OLD.city,OLD.neighborhood,OLD.address,OLD.number) THEN RETURN NEW; END IF;
  END IF;
  c := to_jsonb(NEW);
  allow_prospect := nullif(trim(coalesce(NEW.customer_code,'')),'') IS NULL
   AND EXISTS (SELECT 1 FROM public.stores WHERE id=NEW.store_id AND slug='dicolore')
   AND (public.is_platform_admin(auth.uid()) OR public.is_store_admin(auth.uid(),NEW.store_id)
    OR public.has_store_permission(auth.uid(),NEW.store_id,'can_view_customers')
    OR public.has_store_permission(auth.uid(),NEW.store_id,'can_manage_orders'));
  IF allow_prospect THEN message := public.mpz_prospect_registration_error(c);
  ELSE message := public.mpz_customer_error(c); END IF;
 ELSE
  IF TG_OP = 'UPDATE' THEN
   IF NEW.customer IS NOT DISTINCT FROM OLD.customer THEN RETURN NEW; END IF;
  END IF;
  c := NEW.customer;
  message := public.mpz_customer_error(c);
 END IF;
 IF message IS NOT NULL THEN RAISE EXCEPTION USING MESSAGE = message, ERRCODE = '23514'; END IF;
 RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.mpz_validate_dicolore_release_customer()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE message text;
BEGIN
 IF auth.role()='service_role' OR NEW.status IS DISTINCT FROM 'liberado_transmissao' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id=NEW.store_id AND slug='dicolore') THEN RETURN NEW; END IF;
 message := public.mpz_customer_error(NEW.customer);
 IF message IS NOT NULL THEN RAISE EXCEPTION USING MESSAGE='Cliente faltando campos obrigatórios. ' || message, ERRCODE='23514'; END IF;
 RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION public.mpz_validate_dicolore_release_customer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mpz_validate_dicolore_release_customer() TO authenticated, service_role;
CREATE TRIGGER mpz_validate_dicolore_release_customer BEFORE INSERT OR UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.mpz_validate_dicolore_release_customer();