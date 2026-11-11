CREATE TABLE IF NOT EXISTS public.cep_location_cache (cep text PRIMARY KEY, city text NOT NULL, uf text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.cep_location_cache TO service_role;
ALTER TABLE public.cep_location_cache ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.cep_location_cache IS 'CEP -> city/UF reference used to repair imported customer addresses; service-only.';