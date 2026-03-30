
-- Restringir INSERT em store_visits para evitar spam
DROP POLICY IF EXISTS "Anyone can insert store visits" ON store_visits;
CREATE POLICY "Anyone can insert store visits" ON store_visits
  FOR INSERT TO public
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE is_active = true));
