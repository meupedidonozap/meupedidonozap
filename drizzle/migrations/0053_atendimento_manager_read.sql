CREATE POLICY "Store users with atendimento permission view visits" ON public.customer_visits FOR SELECT TO authenticated
USING (public.has_store_permission(auth.uid(), store_id, 'can_view_atendimento'));
CREATE POLICY "Store users with atendimento permission view geo changes" ON public.customer_geo_changes FOR SELECT TO authenticated
USING (public.has_store_permission(auth.uid(), store_id, 'can_view_atendimento'));