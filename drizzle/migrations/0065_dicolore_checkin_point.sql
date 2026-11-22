CREATE OR REPLACE FUNCTION public.dicolore_checkin_point() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.customer_profiles%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = NEW.store_id AND slug = 'dicolore') THEN RETURN NEW; END IF;
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
  UPDATE public.customer_profiles SET geo_lat = NEW.checkin_lat, geo_lng = NEW.checkin_lng WHERE id = c.id AND store_id = NEW.store_id;
  INSERT INTO public.customer_geo_changes (store_id, customer_profile_id, visit_id, changed_by, seller_code, customer_name, customer_code, old_address, old_lat, old_lng, new_lat, new_lng, new_address, distance_meters, reason, notes)
  VALUES (NEW.store_id, c.id, NEW.id, auth.uid(), c.seller_code, c.name, c.customer_code, concat_ws(', ', c.address, c.number, c.neighborhood, c.city, c.uf, c.cep), c.geo_lat, c.geo_lng, NEW.checkin_lat, NEW.checkin_lng, NULL, NEW.distance_meters_at_checkin, coalesce(NEW.out_of_range_reason, 'Ponto registrado no check-in'), NEW.out_of_range_notes);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.dicolore_checkin_point() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER dicolore_checkin_point AFTER INSERT ON public.customer_visits FOR EACH ROW EXECUTE FUNCTION public.dicolore_checkin_point();