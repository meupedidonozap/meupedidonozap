UPDATE public.orders
SET items = (
  SELECT jsonb_agg(
    CASE
      WHEN (item->>'groupId') = 'LAVATORIO (LITRO)' AND (item ? 'discountPercent') = false
        THEN item || jsonb_build_object('discountPercent', 5)
      WHEN (item->>'groupId') = 'MATERIAL DE APOIO' AND (item ? 'discountPercent') = false
        THEN item || jsonb_build_object('discountPercent', 99)
      ELSE item
    END
  )
  FROM jsonb_array_elements(items) AS item
)
WHERE order_number = 283;