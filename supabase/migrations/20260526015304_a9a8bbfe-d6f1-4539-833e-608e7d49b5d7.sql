UPDATE tab_items
SET paid_order_id = NULL
WHERE paid_order_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = tab_items.paid_order_id);