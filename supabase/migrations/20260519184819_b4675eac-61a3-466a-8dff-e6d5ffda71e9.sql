DROP POLICY IF EXISTS "Store admins can update orders" ON public.orders;

CREATE POLICY "Store admins or managers can update orders"
ON public.orders
FOR UPDATE
USING (
  is_store_admin(auth.uid(), store_id)
  OR has_store_permission(auth.uid(), store_id, 'can_manage_orders')
  OR is_platform_admin(auth.uid())
);