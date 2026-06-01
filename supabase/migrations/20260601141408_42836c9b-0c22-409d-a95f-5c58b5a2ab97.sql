-- 1) Vincula o usuário televendas (store_users) ao seu registro em store_sellers
ALTER TABLE public.store_users
  ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES public.store_sellers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_store_users_seller_id ON public.store_users(seller_id);

-- 2) Função pública para obter destinatários válidos do pedido
CREATE OR REPLACE FUNCTION public.get_order_recipients(p_store_id uuid, p_seller_code text)
RETURNS TABLE(id uuid, name text, whatsapp text, kind text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Vendedor titular do cliente
  SELECT s.id, s.name, s.whatsapp, 'vendedor'::text AS kind
  FROM public.store_sellers s
  WHERE s.store_id = p_store_id
    AND s.is_active = true
    AND NULLIF(btrim(p_seller_code), '') IS NOT NULL
    AND btrim(s.code) = btrim(p_seller_code)

  UNION

  -- Televendas que atendem esse vendedor (via store_users.seller_codes), com seller_id vinculado
  SELECT s.id, s.name, s.whatsapp, 'televendas'::text AS kind
  FROM public.store_users u
  JOIN public.store_sellers s ON s.id = u.seller_id
  WHERE u.store_id = p_store_id
    AND u.is_active = true
    AND u.role = 'televendas'
    AND s.is_active = true
    AND NULLIF(btrim(p_seller_code), '') IS NOT NULL
    AND btrim(p_seller_code) = ANY (u.seller_codes);
$$;

GRANT EXECUTE ON FUNCTION public.get_order_recipients(uuid, text) TO anon, authenticated;