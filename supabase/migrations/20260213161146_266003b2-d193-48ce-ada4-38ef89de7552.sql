
-- Remove the overly permissive public read policy on customer_profiles
DROP POLICY IF EXISTS "Public read customer_profiles" ON public.customer_profiles;

-- Add policy for store admins to read customer profiles in their store
CREATE POLICY "Store admins can read store customer profiles"
ON public.customer_profiles
FOR SELECT
USING (
  auth.uid() = user_id
  OR public.is_store_admin(auth.uid(), store_id)
);
