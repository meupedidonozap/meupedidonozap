CREATE TABLE public.customer_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  external_key text NOT NULL,
  numero text NOT NULL DEFAULT '',
  serie text NOT NULL DEFAULT '',
  filial_codigo text NOT NULL DEFAULT '',
  valor_total_nota_fiscal numeric NOT NULL DEFAULT 0,
  pedido_codigo text NOT NULL DEFAULT '',
  vendedor_codigo text NOT NULL DEFAULT '',
  mensagem_nota_fiscal text,
  data_emissao date,
  cliente_codigo text NOT NULL DEFAULT '',
  valor_total_ipi numeric NOT NULL DEFAULT 0,
  valor_total_st numeric NOT NULL DEFAULT 0,
  valor_total_icms numeric NOT NULL DEFAULT 0,
  tipo_frete text,
  chave_nfe text,
  data_entrega date,
  transportadora_codigo text,
  peso_total_liquido numeric NOT NULL DEFAULT 0,
  peso_total_bruto numeric NOT NULL DEFAULT 0,
  base_icms numeric NOT NULL DEFAULT 0,
  base_st numeric NOT NULL DEFAULT 0,
  valor_total_frete numeric NOT NULL DEFAULT 0,
  valor_total_seguro numeric NOT NULL DEFAULT 0,
  valor_total_desconto numeric NOT NULL DEFAULT 0,
  valor_total_produtos numeric NOT NULL DEFAULT 0,
  valor_total_despesas numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT '',
  condicao_pagamento_codigo text,
  total_quantidade_un_1_faturada numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, external_key)
);

GRANT SELECT ON public.customer_invoices TO authenticated;
GRANT ALL ON public.customer_invoices TO service_role;

ALTER TABLE public.customer_invoices ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_customer_invoices_store_emission ON public.customer_invoices(store_id, data_emissao DESC);
CREATE INDEX idx_customer_invoices_store_customer ON public.customer_invoices(store_id, cliente_codigo);
CREATE INDEX idx_customer_invoices_store_seller ON public.customer_invoices(store_id, vendedor_codigo);
CREATE INDEX idx_customer_invoices_store_number ON public.customer_invoices(store_id, numero, serie);

CREATE POLICY "Invoices visible to store admins"
ON public.customer_invoices
FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.is_store_admin(auth.uid(), store_id));

CREATE POLICY "Invoices visible to seller"
ON public.customer_invoices
FOR SELECT
TO authenticated
USING (public.is_store_seller_code(auth.uid(), store_id, vendedor_codigo));

CREATE POLICY "Invoices visible through customer portfolio"
ON public.customer_invoices
FOR SELECT
TO authenticated
USING (public.has_customer_portfolio_access(auth.uid(), store_id, cliente_codigo));

CREATE POLICY "Invoices visible to own customer"
ON public.customer_invoices
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.customer_profiles cp
    WHERE cp.user_id = auth.uid()
      AND cp.store_id = customer_invoices.store_id
      AND NULLIF(btrim(cp.customer_code), '') IS NOT NULL
      AND btrim(cp.customer_code) = btrim(customer_invoices.cliente_codigo)
  )
);

CREATE TRIGGER trg_customer_invoices_updated
BEFORE UPDATE ON public.customer_invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();