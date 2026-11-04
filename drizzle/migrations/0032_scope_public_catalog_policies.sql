CREATE OR REPLACE FUNCTION public.can_view_store_catalog(_store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.stores s WHERE s.id = _store_id AND s.is_active)
    OR (auth.uid() IS NOT NULL AND public.has_any_store_access(auth.uid(), _store_id));
$$;
CREATE OR REPLACE FUNCTION public.can_view_product_catalog(_product_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.products p WHERE p.id = _product_id AND public.can_view_store_catalog(p.store_id));
$$;

DROP POLICY IF EXISTS "Public read pizza_sizes" ON public.pizza_sizes;
CREATE POLICY "Public read pizza_sizes" ON public.pizza_sizes FOR SELECT USING (public.can_view_store_catalog(store_id));
DROP POLICY IF EXISTS "Public read pizza_flavors" ON public.pizza_flavors;
CREATE POLICY "Public read pizza_flavors" ON public.pizza_flavors FOR SELECT USING (public.can_view_store_catalog(store_id));
DROP POLICY IF EXISTS "Public read food_items" ON public.food_items;
CREATE POLICY "Public read food_items" ON public.food_items FOR SELECT USING (public.can_view_store_catalog(store_id));
DROP POLICY IF EXISTS "Public read categories" ON public.categories;
CREATE POLICY "Public read categories" ON public.categories FOR SELECT USING (public.can_view_store_catalog(store_id));
DROP POLICY IF EXISTS "Public read ingredients" ON public.ingredients;
CREATE POLICY "Public read ingredients" ON public.ingredients FOR SELECT USING (public.can_view_store_catalog(store_id));
DROP POLICY IF EXISTS "Public read pizza_borders" ON public.pizza_borders;
CREATE POLICY "Public read pizza_borders" ON public.pizza_borders FOR SELECT USING (public.can_view_store_catalog(store_id));
DROP POLICY IF EXISTS "Public read products" ON public.products;
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (public.can_view_store_catalog(store_id));
DROP POLICY IF EXISTS "Public read ingredient_categories" ON public.ingredient_categories;
CREATE POLICY "Public read ingredient_categories" ON public.ingredient_categories FOR SELECT USING (EXISTS (SELECT 1 FROM public.ingredients i WHERE i.id = ingredient_id AND public.can_view_store_catalog(i.store_id)));
DROP POLICY IF EXISTS "Public read product_variants" ON public.product_variants;
CREATE POLICY "Public read product_variants" ON public.product_variants FOR SELECT USING (public.can_view_product_catalog(product_id));
DROP POLICY IF EXISTS "Public read product_images" ON public.product_images;
CREATE POLICY "Public read product_images" ON public.product_images FOR SELECT USING (public.can_view_product_catalog(product_id));
DROP POLICY IF EXISTS "Public read product_assembly" ON public.product_assembly;
CREATE POLICY "Public read product_assembly" ON public.product_assembly FOR SELECT USING (public.can_view_product_catalog(product_id));
DROP POLICY IF EXISTS "Kit items are viewable by everyone" ON public.product_kit_items;
CREATE POLICY "Kit items are viewable by everyone" ON public.product_kit_items FOR SELECT USING (public.can_view_product_catalog(kit_product_id));

DROP POLICY IF EXISTS "Anyone can log order errors" ON public.order_create_errors;
CREATE POLICY "Anyone can log order errors" ON public.order_create_errors FOR INSERT
  WITH CHECK ((user_id IS NULL OR user_id = auth.uid()) AND public.can_view_store_catalog(store_id) AND length(error_message) <= 4000);

DROP POLICY IF EXISTS "Public read product images" ON storage.objects;