DO $$ DECLARE definition text; BEGIN
SELECT pg_get_functiondef('public.cleaning_create_quote(uuid,uuid,uuid,jsonb)'::regprocedure) INTO definition;
definition:=replace(definition,'store_id=p_store AND user_id=auth.uid() AND client_key=p_key','store_id=p_store AND created_by=auth.uid() AND client_key=p_key');
definition:=replace(definition,'''pronto'' ELSE ''solicitado'' END) RETURNING * INTO q;','''pronto'' ELSE ''solicitado'' END) ON CONFLICT(store_id,created_by,client_key) DO UPDATE SET client_key=EXCLUDED.client_key RETURNING * INTO q;');
EXECUTE definition;
END $$;