-- 1. Tabela store_users: usuários secundários com permissões granulares
CREATE TABLE public.store_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  can_view_service_orders boolean NOT NULL DEFAULT false,
  can_manage_service_orders boolean NOT NULL DEFAULT false,
  can_view_orders boolean NOT NULL DEFAULT false,
  can_manage_orders boolean NOT NULL DEFAULT false,
  can_manage_products boolean NOT NULL DEFAULT false,
  can_view_customers boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, user_id)
);

ALTER TABLE public.store_users ENABLE ROW LEVEL SECURITY;

-- Trigger updated_at
CREATE TRIGGER trg_store_users_updated_at
BEFORE UPDATE ON public.store_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Helper para checar permissão específica
CREATE OR REPLACE FUNCTION public.has_store_permission(_user_id uuid, _store_id uuid, _permission text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result boolean;
BEGIN
  -- Admin principal ou platform admin sempre tem todas as permissões
  IF public.is_platform_admin(_user_id) THEN
    RETURN true;
  END IF;
  IF EXISTS (SELECT 1 FROM public.store_admins WHERE user_id = _user_id AND store_id = _store_id) THEN
    RETURN true;
  END IF;

  -- Checa permissão dinâmica em store_users
  EXECUTE format(
    'SELECT COALESCE((SELECT %I FROM public.store_users WHERE user_id = $1 AND store_id = $2 AND is_active = true LIMIT 1), false)',
    _permission
  ) INTO v_result USING _user_id, _store_id;
  RETURN COALESCE(v_result, false);
END;
$$;

-- 3. Helper: usuário tem QUALQUER acesso à loja (para uso em listagens)
CREATE OR REPLACE FUNCTION public.has_any_store_access(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.is_platform_admin(_user_id)
    OR EXISTS (SELECT 1 FROM public.store_admins WHERE user_id = _user_id AND store_id = _store_id)
    OR EXISTS (SELECT 1 FROM public.store_users WHERE user_id = _user_id AND store_id = _store_id AND is_active = true);
$$;

-- 4. Políticas RLS para store_users
-- Usuário pode ver seu próprio registro
CREATE POLICY "Users can read own store_users record"
ON public.store_users
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));

-- Apenas admins principais (store_admins) ou platform admins podem inserir
CREATE POLICY "Store admins can insert store_users"
ON public.store_users
FOR INSERT
TO authenticated
WITH CHECK (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));

-- Atualizar permissões: apenas admins principais
CREATE POLICY "Store admins can update store_users"
ON public.store_users
FOR UPDATE
TO authenticated
USING (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));

-- Remover: apenas admins principais
CREATE POLICY "Store admins can delete store_users"
ON public.store_users
FOR DELETE
TO authenticated
USING (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));

-- 5. Permitir que usuários secundários LEIAM service_orders e orders da loja
-- (sem alterar — apenas SELECT) via novas policies que checam has_store_permission
CREATE POLICY "Store users with view permission can read service orders"
ON public.service_orders
FOR SELECT
TO authenticated
USING (has_store_permission(auth.uid(), store_id, 'can_view_service_orders'));

CREATE POLICY "Store users with view permission can read orders"
ON public.orders
FOR SELECT
TO authenticated
USING (has_store_permission(auth.uid(), store_id, 'can_view_orders'));

-- Permitir leitura de customer_profiles para usuários com permissão de OS (precisa ver dados do cliente na OS)
CREATE POLICY "Store users with OS view permission can read customer profiles"
ON public.customer_profiles
FOR SELECT
TO authenticated
USING (
  has_store_permission(auth.uid(), store_id, 'can_view_service_orders')
  OR has_store_permission(auth.uid(), store_id, 'can_view_orders')
  OR has_store_permission(auth.uid(), store_id, 'can_view_customers')
);