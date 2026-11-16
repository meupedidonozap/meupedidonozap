CREATE OR REPLACE FUNCTION public.save_attendance_settings(p_store_id uuid, p_settings jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE entry record; result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.is_platform_admin(auth.uid()) OR public.is_store_admin(auth.uid(),p_store_id) OR public.is_store_manager(auth.uid(),p_store_id)) THEN RAISE EXCEPTION 'Sem permissão para configurar atendimento'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id=p_store_id AND slug='dicolore') THEN RAISE EXCEPTION 'Configuração exclusiva da DiColore'; END IF;
 IF jsonb_typeof(p_settings) IS DISTINCT FROM 'object' OR jsonb_typeof(p_settings->'goals') IS DISTINCT FROM 'object' OR coalesce(p_settings->>'staleDays','') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'Configuração inválida'; END IF;
 IF (p_settings->>'staleDays')::numeric NOT BETWEEN 1 AND 3650 THEN RAISE EXCEPTION 'Prazo inválido'; END IF;
 FOR entry IN SELECT key,value FROM jsonb_each(p_settings->'goals') LOOP
  IF entry.key !~ '^[0-9]+$' OR jsonb_typeof(entry.value) IS DISTINCT FROM 'object' OR coalesce(entry.value->>'visitsPerDay','') !~ '^[0-9]+$' OR coalesce(entry.value->>'minutesPerVisit','') !~ '^[0-9]+(\.[0-9]+)?$' THEN RAISE EXCEPTION 'Meta inválida'; END IF;
  IF (entry.value->>'visitsPerDay')::numeric NOT BETWEEN 0 AND 1000 OR (entry.value->>'minutesPerVisit')::numeric NOT BETWEEN 0 AND 1440 THEN RAISE EXCEPTION 'Meta fora do limite'; END IF;
 END LOOP;
 UPDATE public.stores SET settings=jsonb_set(coalesce(settings,'{}'::jsonb),'{attendanceManagement}',p_settings) WHERE id=p_store_id RETURNING settings->'attendanceManagement' INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.save_attendance_settings(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_attendance_settings(uuid,jsonb) TO authenticated;
CREATE INDEX IF NOT EXISTS customer_visits_store_date_idx ON public.customer_visits(store_id,checked_in_at);
