CREATE OR REPLACE FUNCTION public.dicolore_checkin_point()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c public.customer_profiles%ROWTYPE;
  v_raw text;
  v_radius numeric;
  v_dist numeric;
BEGIN
  SELECT settings->>'maxCheckinDistanceMeters' INTO v_raw FROM public.stores WHERE id = NEW.store_id AND slug = 'dicolore';
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT * INTO c FROM public.customer_profiles WHERE id = NEW.customer_profile_id AND store_id = NEW.store_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não pertence à loja do check-in.'; END IF;
  IF auth.uid() IS NULL OR NEW.seller_user_id IS DISTINCT FROM auth.uid() OR NOT (
    public.is_platform_admin(auth.uid()) OR public.is_store_admin(auth.uid(), NEW.store_id)
    OR public.is_store_manager(auth.uid(), NEW.store_id)
    OR public.is_store_seller_code(auth.uid(), NEW.store_id, c.seller_code)
  ) THEN RAISE EXCEPTION 'Sem autorização para registrar visita neste cliente.'; END IF;
  IF NEW.checkin_lat IS NULL OR NEW.checkin_lng IS NULL OR NOT (NEW.checkin_lat BETWEEN -90 AND 90 AND NEW.checkin_lng BETWEEN -180 AND 180) THEN
    RAISE EXCEPTION 'Localização GPS válida é obrigatória no check-in.';
  END IF;

  IF c.geo_lat IS NULL OR c.geo_lng IS NULL THEN
    -- Cliente sem ponto: a posição confirmada no check-in passa a ser a referência.
    UPDATE public.customer_profiles SET geo_lat = NEW.checkin_lat, geo_lng = NEW.checkin_lng WHERE id = c.id AND store_id = NEW.store_id;
    INSERT INTO public.customer_geo_changes (store_id, customer_profile_id, visit_id, changed_by, seller_code, customer_name, customer_code, old_address, old_lat, old_lng, new_lat, new_lng, new_address, distance_meters, reason, notes)
    VALUES (NEW.store_id, c.id, NEW.id, auth.uid(), c.seller_code, c.name, c.customer_code, concat_ws(', ', c.address, c.number, c.neighborhood, c.city, c.uf, c.cep), NULL, NULL, NEW.checkin_lat, NEW.checkin_lng, NULL, 0, 'Ponto registrado no check-in', NEW.out_of_range_notes);
    v_dist := 0;
  ELSE
    -- Cliente com ponto: valida a distância e bloqueia acima do raio configurado na loja.
    v_radius := greatest(50, CASE WHEN v_raw ~ '^[0-9]+(\.[0-9]+)?$' THEN v_raw::numeric ELSE 300 END);
    v_dist := 2 * 6371000 * asin(least(1, sqrt(
      power(sin(radians(NEW.checkin_lat - c.geo_lat) / 2), 2)
      + cos(radians(c.geo_lat)) * cos(radians(NEW.checkin_lat)) * power(sin(radians(NEW.checkin_lng - c.geo_lng) / 2), 2))));
    IF v_dist > v_radius THEN
      RAISE EXCEPTION 'Check-in fora do raio: você está a % m do ponto do cliente (limite % m).', round(v_dist), round(v_radius);
    END IF;
  END IF;

  UPDATE public.customer_visits SET distance_meters_at_checkin = round(v_dist)
   WHERE id = NEW.id AND distance_meters_at_checkin IS DISTINCT FROM round(v_dist);
  RETURN NEW;
END $function$;