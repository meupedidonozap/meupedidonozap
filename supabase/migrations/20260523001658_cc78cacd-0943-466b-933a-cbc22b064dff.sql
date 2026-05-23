
-- 1. Ingredients table
CREATE TABLE public.ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  name TEXT NOT NULL,
  extra_price NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read ingredients" ON public.ingredients FOR SELECT USING (true);
CREATE POLICY "Store admins manage ingredients" ON public.ingredients FOR ALL
  USING (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()))
  WITH CHECK (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));

CREATE TRIGGER ingredients_updated_at BEFORE UPDATE ON public.ingredients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ingredients_store ON public.ingredients(store_id);

-- 2. Ingredient <-> Category link
CREATE TABLE public.ingredient_categories (
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  category_id UUID NOT NULL,
  PRIMARY KEY (ingredient_id, category_id)
);
ALTER TABLE public.ingredient_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read ingredient_categories" ON public.ingredient_categories FOR SELECT USING (true);
CREATE POLICY "Store admins manage ingredient_categories" ON public.ingredient_categories FOR ALL
  USING (EXISTS (SELECT 1 FROM public.ingredients i WHERE i.id = ingredient_id
    AND (is_store_admin(auth.uid(), i.store_id) OR is_platform_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ingredients i WHERE i.id = ingredient_id
    AND (is_store_admin(auth.uid(), i.store_id) OR is_platform_admin(auth.uid()))));

CREATE INDEX idx_ingredient_categories_cat ON public.ingredient_categories(category_id);

-- 3. Pizza borders
CREATE TABLE public.pizza_borders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pizza_borders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read pizza_borders" ON public.pizza_borders FOR SELECT USING (true);
CREATE POLICY "Store admins manage pizza_borders" ON public.pizza_borders FOR ALL
  USING (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()))
  WITH CHECK (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));

CREATE TRIGGER pizza_borders_updated_at BEFORE UPDATE ON public.pizza_borders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pizza_borders_store ON public.pizza_borders(store_id);

-- 4. Product assembly configuration
CREATE TABLE public.product_assembly (
  product_id UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'fixed' CHECK (mode IN ('fixed','remove','choose')),
  allow_observation BOOLEAN NOT NULL DEFAULT false,
  allow_border BOOLEAN NOT NULL DEFAULT false,
  limits_by_variant JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_ingredient_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.product_assembly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read product_assembly" ON public.product_assembly FOR SELECT USING (true);
CREATE POLICY "Store admins manage product_assembly" ON public.product_assembly FOR ALL
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id
    AND (is_store_admin(auth.uid(), p.store_id) OR is_platform_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id
    AND (is_store_admin(auth.uid(), p.store_id) OR is_platform_admin(auth.uid()))));

CREATE TRIGGER product_assembly_updated_at BEFORE UPDATE ON public.product_assembly
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Migrate food_items -> products (only those not already migrated by name+store)
INSERT INTO public.products (store_id, code, name, description, category_id, base_price, image_url, is_active, has_variants)
SELECT
  fi.store_id,
  COALESCE('F' || LPAD((ROW_NUMBER() OVER (PARTITION BY fi.store_id ORDER BY fi.name))::text, 4, '0'), ''),
  fi.name,
  fi.description,
  fi.category_id,
  fi.price,
  fi.image_url,
  fi.is_active,
  false
FROM public.food_items fi
WHERE NOT EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.store_id = fi.store_id AND lower(p.name) = lower(fi.name)
);
