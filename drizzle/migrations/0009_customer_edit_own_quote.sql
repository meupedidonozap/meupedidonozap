CREATE POLICY "Customers can resubmit own quotes" ON public.orders FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND status = 'orcamento' AND xml_downloaded_at IS NULL)
WITH CHECK (auth.uid() = user_id AND status IN ('orcamento','pendente'));