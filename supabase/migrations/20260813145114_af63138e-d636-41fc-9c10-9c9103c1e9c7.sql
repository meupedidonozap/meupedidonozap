CREATE POLICY "Store users with customer permission can insert customer profiles"
ON public.customer_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id IS NULL
  AND (
    public.has_store_permission(auth.uid(), store_id, 'can_view_customers')
    OR public.has_store_permission(auth.uid(), store_id, 'can_manage_orders')
  )
);