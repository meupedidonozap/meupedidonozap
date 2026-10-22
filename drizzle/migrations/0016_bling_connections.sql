CREATE TABLE public.bling_connections (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  pending_state text,
  connected_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.bling_connections TO service_role;
ALTER TABLE public.bling_connections ENABLE ROW LEVEL SECURITY;