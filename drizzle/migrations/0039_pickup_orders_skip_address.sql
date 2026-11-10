CREATE OR REPLACE FUNCTION public.mpz_customer_error(c jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE key text; label text;
BEGIN
 IF length(trim(coalesce(c->>'name',''))) NOT BETWEEN 1 AND 200 THEN RETURN 'Informe o nome (máximo de 200 caracteres).'; END IF;
 IF NOT public.mpz_valid_document(coalesce(c->>'cpfCnpj',c->>'cpf_cnpj')) THEN RETURN 'Informe um CPF/CNPJ válido.'; END IF;
 IF regexp_replace(coalesce(c->>'whatsapp',''),'[^0-9]','','g') !~ '^[1-9]{2}[0-9]{8,9}$' THEN RETURN 'Informe um telefone com DDD (10 ou 11 dígitos).'; END IF;
 IF upper(trim(coalesce(c->>'address',''))) = 'RETIRAR NA LOJA' THEN RETURN NULL; END IF;
 IF regexp_replace(coalesce(c->>'cep',''),'[^0-9]','','g') !~ '^[0-9]{8}$' THEN RETURN 'Informe um CEP com 8 dígitos.'; END IF;
 IF coalesce(c->>'uf','') NOT IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') THEN RETURN 'Informe uma UF válida.'; END IF;
 FOREACH key IN ARRAY ARRAY['city','neighborhood','address','number'] LOOP
  label := CASE key WHEN 'city' THEN 'a cidade' WHEN 'neighborhood' THEN 'o bairro' WHEN 'address' THEN 'a rua' ELSE 'o número do endereço (ou S/N)' END;
  IF length(trim(coalesce(c->>key,''))) NOT BETWEEN 1 AND (CASE key WHEN 'address' THEN 250 WHEN 'number' THEN 30 ELSE 150 END) THEN RETURN 'Informe ' || label || '.'; END IF;
 END LOOP;
 RETURN NULL;
END $$;