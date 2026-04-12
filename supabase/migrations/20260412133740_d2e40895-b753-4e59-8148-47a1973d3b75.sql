
-- Pizza sizes table
CREATE TABLE public.pizza_sizes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  max_flavors INTEGER NOT NULL DEFAULT 1,
  price NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE public.pizza_sizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read pizza_sizes" ON public.pizza_sizes FOR SELECT USING (true);
CREATE POLICY "Store admins can insert pizza_sizes" ON public.pizza_sizes FOR INSERT WITH CHECK (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));
CREATE POLICY "Store admins can update pizza_sizes" ON public.pizza_sizes FOR UPDATE USING (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));
CREATE POLICY "Store admins can delete pizza_sizes" ON public.pizza_sizes FOR DELETE USING (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));

-- Pizza flavors table
CREATE TABLE public.pizza_flavors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE public.pizza_flavors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read pizza_flavors" ON public.pizza_flavors FOR SELECT USING (true);
CREATE POLICY "Store admins can insert pizza_flavors" ON public.pizza_flavors FOR INSERT WITH CHECK (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));
CREATE POLICY "Store admins can update pizza_flavors" ON public.pizza_flavors FOR UPDATE USING (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));
CREATE POLICY "Store admins can delete pizza_flavors" ON public.pizza_flavors FOR DELETE USING (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));
