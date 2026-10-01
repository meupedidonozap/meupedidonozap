REVOKE EXECUTE ON FUNCTION public.notify_new_pending_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_push_subscription(uuid, uuid, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.upsert_push_subscription(uuid, uuid, text, text, text, text, text) FROM PUBLIC, anon;
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
ALTER EXTENSION btree_gist SET SCHEMA extensions;