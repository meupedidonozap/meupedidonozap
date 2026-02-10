
-- =============================================
-- TABELA: stores
-- =============================================
CREATE TABLE public.stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'LOJA',
  logo TEXT DEFAULT '',
  banner TEXT DEFAULT '',
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  whatsapp TEXT DEFAULT '',
  email TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read stores" ON public.stores FOR SELECT USING (true);
CREATE POLICY "Allow all insert stores" ON public.stores FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update stores" ON public.stores FOR UPDATE USING (true);
CREATE POLICY "Allow all delete stores" ON public.stores FOR DELETE USING (true);

-- =============================================
-- TABELA: categories
-- =============================================
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Allow all insert categories" ON public.categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update categories" ON public.categories FOR UPDATE USING (true);
CREATE POLICY "Allow all delete categories" ON public.categories FOR DELETE USING (true);

-- =============================================
-- TABELA: products
-- =============================================
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  group_id TEXT,
  base_price NUMERIC NOT NULL DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  has_variants BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow all insert products" ON public.products FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update products" ON public.products FOR UPDATE USING (true);
CREATE POLICY "Allow all delete products" ON public.products FOR DELETE USING (true);

-- =============================================
-- TABELA: product_variants
-- =============================================
CREATE TABLE public.product_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  color TEXT,
  size TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  sku TEXT NOT NULL DEFAULT ''
);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read product_variants" ON public.product_variants FOR SELECT USING (true);
CREATE POLICY "Allow all insert product_variants" ON public.product_variants FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update product_variants" ON public.product_variants FOR UPDATE USING (true);
CREATE POLICY "Allow all delete product_variants" ON public.product_variants FOR DELETE USING (true);

-- =============================================
-- TABELA: food_items
-- =============================================
CREATE TABLE public.food_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  preparation_time INTEGER NOT NULL DEFAULT 30
);

ALTER TABLE public.food_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read food_items" ON public.food_items FOR SELECT USING (true);
CREATE POLICY "Allow all insert food_items" ON public.food_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update food_items" ON public.food_items FOR UPDATE USING (true);
CREATE POLICY "Allow all delete food_items" ON public.food_items FOR DELETE USING (true);

-- =============================================
-- TABELA: orders
-- =============================================
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_number SERIAL,
  customer JSONB NOT NULL DEFAULT '{}'::jsonb,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  delivery_fee NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT '',
  delivery_shift TEXT NOT NULL DEFAULT '',
  observations TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Allow all insert orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update orders" ON public.orders FOR UPDATE USING (true);
CREATE POLICY "Allow all delete orders" ON public.orders FOR DELETE USING (true);

-- =============================================
-- TABELA: coupons
-- =============================================
CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  discount_percent NUMERIC,
  discount_value NUMERIC,
  min_order_value NUMERIC NOT NULL DEFAULT 0,
  max_uses INTEGER NOT NULL DEFAULT 100,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  is_active BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read coupons" ON public.coupons FOR SELECT USING (true);
CREATE POLICY "Allow all insert coupons" ON public.coupons FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update coupons" ON public.coupons FOR UPDATE USING (true);
CREATE POLICY "Allow all delete coupons" ON public.coupons FOR DELETE USING (true);

-- =============================================
-- STORAGE: bucket product-images (público)
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

CREATE POLICY "Public read product images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Allow all upload product images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "Allow all update product images" ON storage.objects FOR UPDATE USING (bucket_id = 'product-images');
CREATE POLICY "Allow all delete product images" ON storage.objects FOR DELETE USING (bucket_id = 'product-images');
