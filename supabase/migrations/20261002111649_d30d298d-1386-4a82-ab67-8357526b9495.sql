CREATE TABLE public.customer_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  external_key text NOT NULL,
  filial_codigo text,
  vendedor_codigo text NOT NULL DEFAULT '',
  cliente_codigo text NOT NULL DEFAULT '',
  codigo text,
  nota_fiscal_numero text,
  nota_fiscal_serie text,
  parcela text,
  pedido_codigo text,
  valor_total numeric NOT NULL DEFAULT 0,
  valor_pago numeric NOT NULL DEFAULT 0,
  valor_saldo numeric NOT NULL DEFAULT 0,
  valor_comissao numeric NOT NULL DEFAULT 0,
  data_emissao date,
  data_vencimento date,
  data_quitacao date,
  status text NOT NULL DEFAULT 'ABERTO',
  has_boleto boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, external_key)
);
CREATE INDEX idx_customer_titles_seller ON public.customer_titles(store_id, vendedor_codigo);
CREATE INDEX idx_customer_titles_client ON public.customer_titles(store_id, cliente_codigo);

GRANT SELECT ON public.customer_titles TO authenticated;
GRANT ALL ON public.customer_titles TO service_role;
ALTER TABLE public.customer_titles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Titles visible to store admins" ON public.customer_titles FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.is_store_admin(auth.uid(), store_id));
CREATE POLICY "Titles visible to seller" ON public.customer_titles FOR SELECT TO authenticated
USING (public.is_store_seller_code(auth.uid(), store_id, vendedor_codigo));
CREATE POLICY "Titles visible to own customer" ON public.customer_titles FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.customer_profiles cp WHERE cp.user_id = auth.uid() AND cp.store_id = customer_titles.store_id AND btrim(cp.customer_code) = btrim(customer_titles.cliente_codigo) AND cp.customer_code <> ''));

CREATE TRIGGER trg_customer_titles_updated BEFORE UPDATE ON public.customer_titles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.customer_title_boletos (
  title_id uuid PRIMARY KEY REFERENCES public.customer_titles(id) ON DELETE CASCADE,
  file_name text NOT NULL DEFAULT 'boleto.pdf',
  pdf_base64 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.customer_title_boletos TO authenticated;
GRANT ALL ON public.customer_title_boletos TO service_role;
ALTER TABLE public.customer_title_boletos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Boleto follows title access" ON public.customer_title_boletos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.customer_titles t WHERE t.id = customer_title_boletos.title_id));
CREATE TRIGGER trg_customer_title_boletos_updated BEFORE UPDATE ON public.customer_title_boletos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();