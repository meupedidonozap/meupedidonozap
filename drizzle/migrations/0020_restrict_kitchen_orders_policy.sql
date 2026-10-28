DROP POLICY IF EXISTS "Public read kitchen orders" ON public.orders;
CREATE POLICY "Public read kitchen orders" ON public.orders FOR SELECT
USING (
  status = ANY (ARRAY['pendente'::text, 'em_preparacao'::text])
  AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = orders.store_id AND s.type IN ('COMIDA','PIZZARIA'))
);