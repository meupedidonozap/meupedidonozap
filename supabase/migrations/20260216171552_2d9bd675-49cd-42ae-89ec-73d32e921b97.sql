
-- Create service_orders table
CREATE TABLE public.service_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  customer jsonb NOT NULL DEFAULT '{}'::jsonb,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  extra_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aberta',
  observations text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  os_number serial NOT NULL
);

-- Trigger for updated_at
CREATE TRIGGER update_service_orders_updated_at
  BEFORE UPDATE ON public.service_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;

-- Store admins can do everything
CREATE POLICY "Store admins can read service orders"
  ON public.service_orders FOR SELECT
  USING (is_store_admin(auth.uid(), store_id));

CREATE POLICY "Store admins can insert service orders"
  ON public.service_orders FOR INSERT
  WITH CHECK (is_store_admin(auth.uid(), store_id));

CREATE POLICY "Store admins can update service orders"
  ON public.service_orders FOR UPDATE
  USING (is_store_admin(auth.uid(), store_id));

CREATE POLICY "Store admins can delete service orders"
  ON public.service_orders FOR DELETE
  USING (is_store_admin(auth.uid(), store_id));

-- Customers can read their own service orders
CREATE POLICY "Customers can read own service orders"
  ON public.service_orders FOR SELECT
  USING (auth.uid() = user_id);

-- Store admins can update customer profiles
CREATE POLICY "Store admins can update customer profiles"
  ON public.customer_profiles FOR UPDATE
  USING (is_store_admin(auth.uid(), store_id));
