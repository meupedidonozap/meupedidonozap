
-- Remove overly permissive policies on orders
DROP POLICY IF EXISTS "Allow all insert orders" ON public.orders;
DROP POLICY IF EXISTS "Allow all update orders" ON public.orders;
DROP POLICY IF EXISTS "Allow all delete orders" ON public.orders;
DROP POLICY IF EXISTS "Public read orders" ON public.orders;

-- SELECT: order owner or store admin
CREATE POLICY "Users can read own orders or store admins"
ON public.orders
FOR SELECT
USING (
  (auth.uid() = user_id)
  OR (user_id IS NULL AND public.is_store_admin(auth.uid(), store_id))
  OR public.is_store_admin(auth.uid(), store_id)
);

-- INSERT: authenticated user sets their own user_id, or anonymous (user_id IS NULL)
CREATE POLICY "Authenticated users can create orders"
ON public.orders
FOR INSERT
WITH CHECK (
  (user_id IS NULL)
  OR (auth.uid() = user_id)
);

-- UPDATE: store admins only (for status changes etc.)
CREATE POLICY "Store admins can update orders"
ON public.orders
FOR UPDATE
USING (public.is_store_admin(auth.uid(), store_id));

-- DELETE: store admins only
CREATE POLICY "Store admins can delete orders"
ON public.orders
FOR DELETE
USING (public.is_store_admin(auth.uid(), store_id));
