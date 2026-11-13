CREATE OR REPLACE FUNCTION public.is_store_manager(_user_id uuid, _store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.store_users WHERE user_id=_user_id AND store_id=_store_id AND is_active AND role='gerente')
$$;
CREATE POLICY "Managers read invoices" ON public.customer_invoices FOR SELECT TO authenticated USING (public.is_store_manager(auth.uid(), store_id));
CREATE POLICY "Managers read titles" ON public.customer_titles FOR SELECT TO authenticated USING (public.is_store_manager(auth.uid(), store_id));
CREATE POLICY "Managers read erp orders" ON public.erp_orders FOR SELECT TO authenticated USING (public.is_store_manager(auth.uid(), store_id));
CREATE POLICY "Managers read erp items" ON public.erp_order_items FOR SELECT TO authenticated USING (public.is_store_manager(auth.uid(), store_id));
CREATE POLICY "Managers read orders" ON public.orders FOR SELECT TO authenticated USING (public.is_store_manager(auth.uid(), store_id));
CREATE POLICY "Managers read visits" ON public.customer_visits FOR SELECT TO authenticated USING (public.is_store_manager(auth.uid(), store_id));
CREATE POLICY "Managers read customer profiles" ON public.customer_profiles FOR SELECT TO authenticated USING (public.is_store_manager(auth.uid(), store_id));