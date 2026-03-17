
ALTER TABLE public.customer_profiles ADD COLUMN is_active boolean NOT NULL DEFAULT true;

CREATE POLICY "Store admins can delete customer profiles"
ON public.customer_profiles
FOR DELETE
TO authenticated
USING (is_store_admin(auth.uid(), store_id));
