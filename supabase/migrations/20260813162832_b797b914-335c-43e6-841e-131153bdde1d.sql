ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS client_order_id text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_store_client_order_id_key
  ON public.orders (store_id, client_order_id)
  WHERE client_order_id IS NOT NULL;