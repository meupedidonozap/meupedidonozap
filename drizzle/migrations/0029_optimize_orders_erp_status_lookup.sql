SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

CREATE INDEX IF NOT EXISTS idx_orders_store_erp_order_code
  ON public.orders (store_id, erp_order_code);

CREATE INDEX IF NOT EXISTS idx_orders_order_number
  ON public.orders (order_number);

CREATE INDEX IF NOT EXISTS idx_orders_store_order_number_text
  ON public.orders (store_id, (order_number::text));

COMMENT ON INDEX public.idx_orders_store_order_number_text IS
  'Supports the exact text comparison used by sync_order_status_from_erp without changing ERP matching rules.';