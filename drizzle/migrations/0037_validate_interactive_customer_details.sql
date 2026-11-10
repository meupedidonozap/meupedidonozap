CREATE OR REPLACE FUNCTION public.mpz_valid_document(value text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE d text := regexp_replace(coalesce(value,''), '[^0-9]', '', 'g'); n int; s int; check_digit int; pos int; weight int;
BEGIN
 n := length(d);
 IF n NOT IN (11,14) OR d = repeat(substr(d,1,1),n) THEN RETURN false; END IF;
 FOR pos IN (n-1)..n LOOP
  s := 0;
  FOR i IN 1..(pos-1) LOOP
   IF n=11 THEN weight := pos+1-i; ELSE weight := ((pos-1-i)%8)+2; END IF;
   s := s + substr(d,i,1)::int * weight;
  END LOOP;
  check_digit := CASE WHEN s%11 < 2 THEN 0 ELSE 11-s%11 END;
  IF substr(d,pos,1)::int <> check_digit THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.mpz_customer_error(c jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE key text; label text;
BEGIN
 IF length(trim(coalesce(c->>'name',''))) NOT BETWEEN 1 AND 200 THEN RETURN 'Informe o nome (máximo de 200 caracteres).'; END IF;
 IF NOT public.mpz_valid_document(coalesce(c->>'cpfCnpj',c->>'cpf_cnpj')) THEN RETURN 'Informe um CPF/CNPJ válido.'; END IF;
 IF regexp_replace(coalesce(c->>'whatsapp',''),'[^0-9]','','g') !~ '^[1-9]{2}[0-9]{8,9}$' THEN RETURN 'Informe um telefone com DDD (10 ou 11 dígitos).'; END IF;
 IF regexp_replace(coalesce(c->>'cep',''),'[^0-9]','','g') !~ '^[0-9]{8}$' THEN RETURN 'Informe um CEP com 8 dígitos.'; END IF;
 IF coalesce(c->>'uf','') NOT IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') THEN RETURN 'Informe uma UF válida.'; END IF;
 FOREACH key IN ARRAY ARRAY['city','neighborhood','address','number'] LOOP
  label := CASE key WHEN 'city' THEN 'a cidade' WHEN 'neighborhood' THEN 'o bairro' WHEN 'address' THEN 'a rua' ELSE 'o número do endereço (ou S/N)' END;
  IF length(trim(coalesce(c->>key,''))) NOT BETWEEN 1 AND (CASE key WHEN 'address' THEN 250 WHEN 'number' THEN 30 ELSE 150 END) THEN RETURN 'Informe ' || label || '.'; END IF;
 END LOOP;
 RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION public.mpz_validate_customer_write() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE c jsonb; message text;
BEGIN
 IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME = 'customer_profiles' THEN
  IF TG_OP = 'UPDATE' THEN
   IF ROW(NEW.name,NEW.cpf_cnpj,NEW.whatsapp,NEW.cep,NEW.uf,NEW.city,NEW.neighborhood,NEW.address,NEW.number) IS NOT DISTINCT FROM ROW(OLD.name,OLD.cpf_cnpj,OLD.whatsapp,OLD.cep,OLD.uf,OLD.city,OLD.neighborhood,OLD.address,OLD.number) THEN RETURN NEW; END IF;
  END IF;
  c := to_jsonb(NEW);
 ELSE
  IF TG_OP = 'UPDATE' THEN
   IF NEW.customer IS NOT DISTINCT FROM OLD.customer THEN RETURN NEW; END IF;
  END IF;
  c := NEW.customer;
 END IF;
 message := public.mpz_customer_error(c);
 IF message IS NOT NULL THEN RAISE EXCEPTION USING MESSAGE = message, ERRCODE = '23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER mpz_validate_profile_details BEFORE INSERT OR UPDATE ON public.customer_profiles FOR EACH ROW EXECUTE FUNCTION public.mpz_validate_customer_write();
CREATE TRIGGER mpz_validate_order_details BEFORE INSERT OR UPDATE OF customer ON public.orders FOR EACH ROW EXECUTE FUNCTION public.mpz_validate_customer_write();