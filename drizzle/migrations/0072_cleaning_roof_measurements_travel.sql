CREATE TABLE public.cleaning_travel_estimates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), store_id uuid NOT NULL REFERENCES public.stores(id), user_id uuid NOT NULL,
 base_address jsonb NOT NULL, site_address jsonb NOT NULL, one_way_meters integer NOT NULL CHECK(one_way_meters>=0 AND one_way_meters<=2000000),
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours'
);
GRANT SELECT ON public.cleaning_travel_estimates TO authenticated;
GRANT ALL ON public.cleaning_travel_estimates TO service_role;
ALTER TABLE public.cleaning_travel_estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cleaning own travel estimates" ON public.cleaning_travel_estimates FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.cleaning_admin(store_id));
CREATE INDEX cleaning_travel_cache ON public.cleaning_travel_estimates(store_id,user_id,created_at DESC);

CREATE OR REPLACE FUNCTION public.cleaning_valid_address(a jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT coalesce(jsonb_typeof(a)='object' AND a->>'cep' ~ '^\d{8}$' AND a->>'uf' ~ '^[A-Z]{2}$'
 AND length(trim(a->>'address')) BETWEEN 1 AND 200 AND length(trim(a->>'number')) BETWEEN 1 AND 20
 AND length(trim(a->>'neighborhood')) BETWEEN 1 AND 100 AND length(trim(a->>'city')) BETWEEN 1 AND 100 AND length(coalesce(a->>'complement',''))<=200,false)
$$;

CREATE OR REPLACE FUNCTION public.cleaning_save_estimate_settings(p_store uuid,p_settings jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb; other jsonb; i integer:=0; j integer; BEGIN
 IF NOT public.cleaning_admin(p_store) THEN RAISE EXCEPTION 'Configuração não autorizada.'; END IF;
 IF jsonb_typeof(p_settings) IS DISTINCT FROM 'object' OR p_settings->'round_trip' IS DISTINCT FROM 'true'::jsonb OR (p_settings->'base_address' IS DISTINCT FROM 'null'::jsonb AND NOT public.cleaning_valid_address(p_settings->'base_address')) OR jsonb_typeof(p_settings->'fall_ranges') IS DISTINCT FROM 'array' OR jsonb_array_length(p_settings->'fall_ranges')>20 THEN RAISE EXCEPTION 'Configuração de orçamento inválida.'; END IF;
 IF p_settings->'solar_price' IS DISTINCT FROM 'null'::jsonb AND (jsonb_typeof(p_settings->'solar_price') IS DISTINCT FROM 'number' OR (p_settings->>'solar_price')::numeric NOT BETWEEN 0 AND 999999) THEN RAISE EXCEPTION 'Adicional solar inválido.'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_settings->'fall_ranges') LOOP
  IF jsonb_typeof(r->'min') IS DISTINCT FROM 'number' OR jsonb_typeof(r->'max') IS DISTINCT FROM 'number' OR jsonb_typeof(r->'price') IS DISTINCT FROM 'number' OR (r->>'min')::numeric<>trunc((r->>'min')::numeric) OR (r->>'max')::numeric<>trunc((r->>'max')::numeric) OR (r->>'min')::numeric NOT BETWEEN 1 AND 100 OR (r->>'max')::numeric NOT BETWEEN (r->>'min')::numeric AND 100 OR (r->>'price')::numeric NOT BETWEEN 0 AND 999999 THEN RAISE EXCEPTION 'Faixa de quedas inválida.'; END IF;
  j:=0; FOR other IN SELECT value FROM jsonb_array_elements(p_settings->'fall_ranges') LOOP
   IF i<>j AND (r->>'min')::numeric<=(other->>'max')::numeric AND (r->>'max')::numeric>=(other->>'min')::numeric THEN RAISE EXCEPTION 'As faixas de quedas não podem se sobrepor.'; END IF; j:=j+1;
  END LOOP; i:=i+1;
 END LOOP;
 UPDATE public.stores SET settings=jsonb_set(settings,'{cleaningEstimate}',p_settings,true) WHERE id=p_store;
 RETURN p_settings;
END $$;
REVOKE ALL ON FUNCTION public.cleaning_save_estimate_settings(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cleaning_save_estimate_settings(uuid,jsonb) TO authenticated;

DO $$ BEGIN
 EXECUTE replace(pg_get_functiondef('public.cleaning_create_quote(uuid,uuid,uuid,jsonb)'::regprocedure),'FUNCTION public.cleaning_create_quote(', 'FUNCTION public.cleaning_create_quote_base(');
END $$;
REVOKE ALL ON FUNCTION public.cleaning_create_quote_base(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.cleaning_create_quote(p_store uuid,p_profile uuid,p_key uuid,p_input jsonb) RETURNS public.cleaning_quotes LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q public.cleaning_quotes; a jsonb; dimensions jsonb:='[]'; normalized jsonb; cfg jsonb; extra jsonb:='[]'; area numeric; len numeric; wid numeric; slope numeric; sumarea numeric; price numeric; surcharge numeric:=0; ready boolean:=true; falls integer; travel public.cleaning_travel_estimates; addr jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.stores WHERE id=p_store AND slug='limpa-telhas-brusque' AND is_active) THEN RAISE EXCEPTION 'Faça login nesta loja.'; END IF;
 SELECT * INTO q FROM public.cleaning_quotes WHERE store_id=p_store AND created_by=auth.uid() AND client_key=p_key; IF FOUND THEN RETURN q; END IF;
 -- Existing clients keep the original contract; new screens always send roof_areas.
 IF NOT (p_input ? 'roof_areas') THEN RETURN public.cleaning_create_quote_base(p_store,p_profile,p_key,p_input); END IF;
 IF jsonb_typeof(p_input->'roof_areas') IS DISTINCT FROM 'array' OR jsonb_array_length(p_input->'roof_areas') NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Informe entre uma e vinte áreas.'; END IF;
 FOR a IN SELECT value FROM jsonb_array_elements(p_input->'roof_areas') LOOP
  IF a->>'mode'='known' THEN
   IF jsonb_typeof(a->'area') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Área inválida.'; END IF; area:=(a->>'area')::numeric;
  ELSIF a->>'mode'='dimensions' THEN
   IF jsonb_typeof(a->'length') IS DISTINCT FROM 'number' OR jsonb_typeof(a->'width') IS DISTINCT FROM 'number' OR jsonb_typeof(a->'slope') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Medidas inválidas.'; END IF;
   len:=(a->>'length')::numeric; wid:=(a->>'width')::numeric; slope:=(a->>'slope')::numeric;
   IF len NOT BETWEEN 0.01 AND 100000 OR wid NOT BETWEEN 0.01 AND 100000 OR slope NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Medidas inválidas.'; END IF;
   area:=round(len*wid*(1+slope/100),2);
  ELSE RAISE EXCEPTION 'Modo de medição inválido.'; END IF;
  IF area<=0 OR area>100000 THEN RAISE EXCEPTION 'Área inválida.'; END IF;
  dimensions:=dimensions||jsonb_build_array(a||jsonb_build_object('estimated_area',round(area,2)));
 END LOOP;
 SELECT jsonb_agg(jsonb_build_object('service_id',service_id,'area',total_area)) INTO normalized FROM (SELECT v->>'service_id' service_id,sum((v->>'estimated_area')::numeric) total_area FROM jsonb_array_elements(dimensions) v GROUP BY v->>'service_id') totals;
 IF NOT public.cleaning_valid_address(p_input->'site_address') OR jsonb_typeof(p_input->'has_solar') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p_input->'falls') IS DISTINCT FROM 'number' OR (p_input->>'falls')::numeric<>trunc((p_input->>'falls')::numeric) OR (p_input->>'falls')::numeric NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Complete o endereço, placas solares e quantidade de quedas.'; END IF;
 addr:=p_input->'site_address'; falls:=(p_input->>'falls')::integer;
 SELECT settings->'cleaningEstimate' INTO cfg FROM public.stores WHERE id=p_store FOR SHARE;
 IF (p_input->>'has_solar')::boolean THEN
  price:=(cfg->>'solar_price')::numeric; ready:=ready AND price IS NOT NULL; surcharge:=surcharge+coalesce(price,0);
  extra:=extra||jsonb_build_array(jsonb_build_object('name','Presença de placa solar','mode','fixed','unit_price',price,'total',price));
 END IF;
 SELECT (value->>'price')::numeric INTO price FROM jsonb_array_elements(coalesce(cfg->'fall_ranges','[]'::jsonb)) WHERE falls BETWEEN (value->>'min')::integer AND (value->>'max')::integer LIMIT 1;
 ready:=ready AND price IS NOT NULL; surcharge:=surcharge+coalesce(price,0);
 extra:=extra||jsonb_build_array(jsonb_build_object('name',falls||' águas (quedas)','mode','fixed','unit_price',price,'total',price));
 IF p_input ? 'travel_estimate_id' THEN
  SELECT * INTO travel FROM public.cleaning_travel_estimates WHERE id=(p_input->>'travel_estimate_id')::uuid AND store_id=p_store AND user_id=auth.uid() AND site_address=addr AND base_address=cfg->'base_address' AND expires_at>now();
  IF NOT FOUND THEN RAISE EXCEPTION 'Recalcule o deslocamento: o endereço ou a base mudou, ou a estimativa expirou.'; END IF;
  price:=round(travel.one_way_meters::numeric/1000*2*1.20,2);
 ELSE price:=NULL; END IF;
 ready:=ready AND price IS NOT NULL; surcharge:=surcharge+coalesce(price,0);
 extra:=extra||jsonb_build_array(jsonb_build_object('name','Deslocamento (ida e volta)','mode','fixed','unit_price',1.20,'total',price,'km',CASE WHEN travel.id IS NOT NULL THEN travel.one_way_meters::numeric/1000*2 ELSE NULL END));
 q:=public.cleaning_create_quote_base(p_store,p_profile,p_key,jsonb_set(p_input,'{items}',normalized));
 UPDATE public.cleaning_quotes SET addons=addons||extra,
 details=details||jsonb_build_object('roof_areas',dimensions,'estimated_area',(SELECT sum((v->>'estimated_area')::numeric) FROM jsonb_array_elements(dimensions) v),'site_address',addr,'travel',jsonb_build_object('estimate_id',travel.id,'one_way_meters',travel.one_way_meters,'round_trip',true,'rate',1.20,'total',price)),
 total=CASE WHEN ready AND q.total IS NOT NULL THEN round(q.total+surcharge,2) ELSE NULL END,
 status=CASE WHEN ready AND q.total IS NOT NULL THEN 'pronto' ELSE 'solicitado' END WHERE id=q.id RETURNING * INTO q;
 RETURN q;
END $$;
REVOKE ALL ON FUNCTION public.cleaning_create_quote(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cleaning_create_quote(uuid,uuid,uuid,jsonb) TO authenticated;
COMMENT ON FUNCTION public.cleaning_create_quote_base(uuid,uuid,uuid,jsonb) IS 'Internal legacy price resolver; execute revoked from API roles. New wrapper validates roof areas and store-owned extras.';