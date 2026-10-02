CREATE TABLE public.erp_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  external_key text NOT NULL,
  codigo text NOT NULL DEFAULT '',
  codigo_importacao text NOT NULL DEFAULT '',
  filial_codigo text NOT NULL DEFAULT '',
  cliente_codigo text NOT NULL DEFAULT '',
  vendedor_codigo text NOT NULL DEFAULT '',
  tabela_preco_codigo text,
  condicao_pagamento_codigo text,
  operacao_codigo text,
  observacao text,
  data_emissao date,
  data_entrega date,
  data_faturamento date,
  valor_total numeric NOT NULL DEFAULT 0,
  valor_desconto numeric NOT NULL DEFAULT 0,
  valor_faturado numeric NOT NULL DEFAULT 0,
  quantidade_total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'N',
  ordem_faturamento text,
  nota_fiscal_numero text,
  pedido_origem text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, external_key)
);
CREATE INDEX idx_erp_orders_store_date ON public.erp_orders (store_id, data_emissao DESC);
CREATE INDEX idx_erp_orders_store_cliente ON public.erp_orders (store_id, cliente_codigo);

CREATE TABLE public.erp_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_key text NOT NULL,
  cliente_codigo text NOT NULL DEFAULT '',
  produto_codigo text NOT NULL DEFAULT '',
  produto_descricao text,
  quantidade numeric NOT NULL DEFAULT 0,
  quantidade_faturada numeric NOT NULL DEFAULT 0,
  valor_unitario numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  percentual_desconto numeric NOT NULL DEFAULT 0,
  status text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_erp_order_items_order ON public.erp_order_items (store_id, order_key);

GRANT SELECT ON public.erp_orders TO authenticated;
GRANT ALL ON public.erp_orders TO service_role;
GRANT SELECT ON public.erp_order_items TO authenticated;
GRANT ALL ON public.erp_order_items TO service_role;

ALTER TABLE public.erp_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ERP orders visible to admins" ON public.erp_orders FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.is_store_admin(auth.uid(), store_id));
CREATE POLICY "ERP orders visible through customer portfolio" ON public.erp_orders FOR SELECT TO authenticated
USING ((store_id, cliente_codigo) IN (SELECT k.store_id, k.customer_code FROM public.portfolio_customer_keys(auth.uid()) k));

CREATE POLICY "ERP order items visible to admins" ON public.erp_order_items FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.is_store_admin(auth.uid(), store_id));
CREATE POLICY "ERP order items visible through customer portfolio" ON public.erp_order_items FOR SELECT TO authenticated
USING ((store_id, cliente_codigo) IN (SELECT k.store_id, k.customer_code FROM public.portfolio_customer_keys(auth.uid()) k));

CREATE TRIGGER trg_erp_orders_updated BEFORE UPDATE ON public.erp_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();