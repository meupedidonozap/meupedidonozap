DO $$
DECLARE
  source_store uuid;
  target_store uuid;
BEGIN
  SELECT id INTO source_store FROM public.stores WHERE slug = 'dicolore' LIMIT 1;
  IF source_store IS NULL THEN RAISE EXCEPTION 'Loja DiColore não encontrada'; END IF;

  SELECT id INTO target_store FROM public.stores WHERE slug = 'mabelle' LIMIT 1;
  IF target_store IS NULL THEN
    INSERT INTO public.stores (slug, name, type, logo, banner, address, phone, whatsapp, email, is_active, settings, license_expires_at, sort_order)
    SELECT 'mabelle', 'MABELLE', type, '', '', '', '', '', '', true,
      (settings
        - 'cnpj' - 'condicoesPagamento' - 'formasPagamento' - 'erpReleaseWhatsapp'
        - 'useBlingIntegration' - 'useStockIntegration' - 'dataVersion')
      || jsonb_build_object(
        'acceptPix', true,
        'acceptCard', true,
        'acceptBoleto', false,
        'onlinePayments', true,
        'offersDelivery', true,
        'catalogViewModes', jsonb_build_object('list', true, 'grid', true),
        'shipping', jsonb_build_object(
          'enabled', false, 'originCep', '', 'defaultWeight', 0.5,
          'defaultLength', 20, 'defaultWidth', 15, 'defaultHeight', 10,
          'enabledServices', jsonb_build_array('PAC', 'SEDEX')
        )
      ),
      license_expires_at,
      COALESCE((SELECT max(sort_order) + 1 FROM public.stores), 0)
    FROM public.stores WHERE id = source_store
    RETURNING id INTO target_store;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE store_id = target_store) THEN
    DROP TABLE IF EXISTS mabelle_category_map;
    DROP TABLE IF EXISTS mabelle_product_map;
    CREATE TEMP TABLE mabelle_category_map (source_id uuid primary key, target_id uuid not null) ON COMMIT DROP;
    CREATE TEMP TABLE mabelle_product_map (source_id uuid primary key, target_id uuid not null) ON COMMIT DROP;

    WITH inserted AS (
      INSERT INTO public.categories (store_id, name, sort_order, commission_percent)
      SELECT target_store, name, sort_order, commission_percent
      FROM public.categories WHERE store_id = source_store
      RETURNING id, name
    )
    INSERT INTO mabelle_category_map(source_id, target_id)
    SELECT source.id, inserted.id
    FROM public.categories source
    JOIN inserted ON inserted.name = source.name
    WHERE source.store_id = source_store;

    INSERT INTO mabelle_product_map(source_id, target_id)
    SELECT id, gen_random_uuid() FROM public.products WHERE store_id = source_store;

    INSERT INTO public.products (
      id, store_id, code, name, description, category_id, group_id, base_price,
      image_url, is_active, has_variants, duration_minutes, price_table_1,
      price_table_4, price_table_9, price_table_res, stock, is_kit, unit,
      price_table_11, bling_code
    )
    SELECT pm.target_id, target_store, p.code, p.name, p.description, cm.target_id,
      p.group_id, p.base_price, p.image_url, p.is_active, p.has_variants,
      p.duration_minutes, p.price_table_1, p.price_table_4, p.price_table_9,
      p.price_table_res, p.stock, p.is_kit, p.unit, p.price_table_11, NULL
    FROM public.products p
    JOIN mabelle_product_map pm ON pm.source_id = p.id
    LEFT JOIN mabelle_category_map cm ON cm.source_id = p.category_id
    WHERE p.store_id = source_store;

    INSERT INTO public.product_variants (
      product_id, color, size, price, stock, sku, price_table_1, price_table_4,
      price_table_9, price_table_res, price_table_11
    )
    SELECT pm.target_id, v.color, v.size, v.price, v.stock, v.sku, v.price_table_1,
      v.price_table_4, v.price_table_9, v.price_table_res, v.price_table_11
    FROM public.product_variants v
    JOIN mabelle_product_map pm ON pm.source_id = v.product_id;

    INSERT INTO public.product_images (product_id, image_url, sort_order, label)
    SELECT pm.target_id, i.image_url, i.sort_order, i.label
    FROM public.product_images i
    JOIN mabelle_product_map pm ON pm.source_id = i.product_id;

    INSERT INTO public.product_kit_items (kit_product_id, component_product_id, quantity, sort_order)
    SELECT kit.target_id, component.target_id, item.quantity, item.sort_order
    FROM public.product_kit_items item
    JOIN mabelle_product_map kit ON kit.source_id = item.kit_product_id
    JOIN mabelle_product_map component ON component.source_id = item.component_product_id;
  END IF;
END $$;