CREATE OR REPLACE FUNCTION public.get_order_recipients(p_store_id uuid, p_seller_code text)
RETURNS TABLE(id uuid, name text, whatsapp text, kind text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Vendedor titular do cliente
  SELECT s.id, s.name, s.whatsapp, 'vendedor'::text AS kind
  FROM public.store_sellers s
  WHERE s.store_id = p_store_id
    AND s.is_active = true
    AND NULLIF(btrim(p_seller_code), '') IS NOT NULL
    AND btrim(s.code) = btrim(p_seller_code)

  UNION

  -- Televendas que atendem esse vendedor (via store_users.seller_codes).
  -- Vincula com store_sellers por: seller_id explícito, OU nome igual,
  -- OU nome igual após remover a palavra "televendas" (tolerante a ordem).
  SELECT s.id, s.name, s.whatsapp, 'televendas'::text AS kind
  FROM public.store_users u
  JOIN public.store_sellers s
    ON s.store_id = u.store_id
   AND s.is_active = true
   AND (
        (u.seller_id IS NOT NULL AND s.id = u.seller_id)
     OR (u.seller_id IS NULL AND lower(btrim(s.name)) = lower(btrim(u.name)))
     OR (u.seller_id IS NULL AND
         btrim(regexp_replace(lower(s.name), 'televendas', '', 'g')) =
         btrim(regexp_replace(lower(u.name), 'televendas', '', 'g'))
         AND btrim(regexp_replace(lower(u.name), 'televendas', '', 'g')) <> '')
   )
  WHERE u.store_id = p_store_id
    AND u.is_active = true
    AND u.role = 'televendas'
    AND NULLIF(btrim(p_seller_code), '') IS NOT NULL
    AND btrim(p_seller_code) = ANY (u.seller_codes);
$function$;