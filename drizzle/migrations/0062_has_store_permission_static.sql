CREATE OR REPLACE FUNCTION public.has_store_permission(_user_id uuid, _store_id uuid, _permission text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  su public.store_users%ROWTYPE;
BEGIN
  IF public.is_platform_admin(_user_id) THEN
    RETURN true;
  END IF;
  IF EXISTS (SELECT 1 FROM public.store_admins WHERE user_id = _user_id AND store_id = _store_id) THEN
    RETURN true;
  END IF;

  SELECT * INTO su FROM public.store_users
   WHERE user_id = _user_id AND store_id = _store_id AND is_active = true LIMIT 1;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN COALESCE(CASE _permission
    WHEN 'can_view_service_orders' THEN su.can_view_service_orders
    WHEN 'can_manage_service_orders' THEN su.can_manage_service_orders
    WHEN 'can_view_orders' THEN su.can_view_orders
    WHEN 'can_manage_orders' THEN su.can_manage_orders
    WHEN 'can_manage_products' THEN su.can_manage_products
    WHEN 'can_view_customers' THEN su.can_view_customers
    WHEN 'can_manage_tables' THEN su.can_manage_tables
    WHEN 'can_change_price_table' THEN su.can_change_price_table
    WHEN 'can_manage_categories' THEN su.can_manage_categories
    WHEN 'can_view_atendimento' THEN su.can_view_atendimento
    WHEN 'can_view_discounts' THEN su.can_view_discounts
    WHEN 'can_manage_discounts' THEN su.can_manage_discounts
    WHEN 'can_manage_customers' THEN su.can_manage_customers
    WHEN 'can_view_wishlist' THEN su.can_view_wishlist
    WHEN 'can_manage_technical_materials' THEN su.can_manage_technical_materials
    ELSE false
  END, false);
END;
$function$;