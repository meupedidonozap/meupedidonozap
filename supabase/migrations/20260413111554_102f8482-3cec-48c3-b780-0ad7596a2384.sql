-- Add origem column to orders
ALTER TABLE public.orders ADD COLUMN origem text NOT NULL DEFAULT 'web';

-- Enable realtime for orders table
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Add RLS policy for public read of orders with status pendente/em_preparacao (kitchen screen)
CREATE POLICY "Public read kitchen orders"
ON public.orders
FOR SELECT
TO public
USING (status IN ('pendente', 'em_preparacao'));

-- Allow public update of status for kitchen screen (only status field changes)
CREATE POLICY "Public update kitchen order status"
ON public.orders
FOR UPDATE
TO public
USING (status IN ('pendente', 'em_preparacao'))
WITH CHECK (status IN ('pendente', 'em_preparacao', 'pronto'));