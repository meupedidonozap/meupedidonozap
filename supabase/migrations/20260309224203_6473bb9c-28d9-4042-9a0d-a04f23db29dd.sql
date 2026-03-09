
-- Make user_id nullable for manually created customers
ALTER TABLE public.customer_profiles ALTER COLUMN user_id DROP NOT NULL;

-- Allow store admins to insert customer profiles (for manual creation)
CREATE POLICY "Store admins can insert customer profiles"
ON public.customer_profiles
FOR INSERT
TO authenticated
WITH CHECK (is_store_admin(auth.uid(), store_id));
