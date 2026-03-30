
-- 1. Restringir cupons: apenas cupons ativos visíveis publicamente
DROP POLICY IF EXISTS "Public read coupons" ON coupons;
CREATE POLICY "Public read active coupons" ON coupons
  FOR SELECT TO public
  USING (is_active = true);

-- 2. Restringir lojas inativas do acesso público
DROP POLICY IF EXISTS "Public read stores" ON stores;
CREATE POLICY "Public read active stores" ON stores
  FOR SELECT TO public
  USING (is_active = true OR is_store_admin(auth.uid(), id) OR is_platform_admin(auth.uid()));

-- 3. Simplificar política redundante de orders
DROP POLICY IF EXISTS "Users can read own orders or store admins" ON orders;
CREATE POLICY "Users can read own orders or store admins" ON orders
  FOR SELECT TO public
  USING (auth.uid() = user_id OR is_store_admin(auth.uid(), store_id));
