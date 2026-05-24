
-- 1) Coluna nova
ALTER TABLE public.store_users
  ADD COLUMN IF NOT EXISTS can_manage_tables boolean NOT NULL DEFAULT false;

-- 2) Atualiza a função has_store_permission para reconhecer can_manage_tables
-- (a função existente já lê o nome da coluna dinamicamente; sem necessidade de mudança extra)

-- 3) Ampliar RLS para Garçom em table_sessions
DROP POLICY IF EXISTS "Store users insert table_sessions" ON public.table_sessions;
CREATE POLICY "Store users insert table_sessions" ON public.table_sessions
  FOR INSERT WITH CHECK (
    is_store_admin(auth.uid(), store_id)
    OR is_platform_admin(auth.uid())
    OR has_store_permission(auth.uid(), store_id, 'can_manage_orders')
    OR has_store_permission(auth.uid(), store_id, 'can_manage_tables')
  );

DROP POLICY IF EXISTS "Store users read table_sessions" ON public.table_sessions;
CREATE POLICY "Store users read table_sessions" ON public.table_sessions
  FOR SELECT USING (
    is_store_admin(auth.uid(), store_id)
    OR is_platform_admin(auth.uid())
    OR has_store_permission(auth.uid(), store_id, 'can_manage_orders')
    OR has_store_permission(auth.uid(), store_id, 'can_view_orders')
    OR has_store_permission(auth.uid(), store_id, 'can_manage_tables')
  );

DROP POLICY IF EXISTS "Store users update table_sessions" ON public.table_sessions;
CREATE POLICY "Store users update table_sessions" ON public.table_sessions
  FOR UPDATE USING (
    is_store_admin(auth.uid(), store_id)
    OR is_platform_admin(auth.uid())
    OR has_store_permission(auth.uid(), store_id, 'can_manage_orders')
    OR has_store_permission(auth.uid(), store_id, 'can_manage_tables')
  );

-- 4) table_tabs
DROP POLICY IF EXISTS "Store users manage table_tabs" ON public.table_tabs;
CREATE POLICY "Store users manage table_tabs" ON public.table_tabs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.table_sessions s
      WHERE s.id = table_tabs.session_id
        AND (
          is_store_admin(auth.uid(), s.store_id)
          OR is_platform_admin(auth.uid())
          OR has_store_permission(auth.uid(), s.store_id, 'can_manage_orders')
          OR has_store_permission(auth.uid(), s.store_id, 'can_manage_tables')
        )
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.table_sessions s
      WHERE s.id = table_tabs.session_id
        AND (
          is_store_admin(auth.uid(), s.store_id)
          OR is_platform_admin(auth.uid())
          OR has_store_permission(auth.uid(), s.store_id, 'can_manage_orders')
          OR has_store_permission(auth.uid(), s.store_id, 'can_manage_tables')
        )
    )
  );

DROP POLICY IF EXISTS "Store users read table_tabs" ON public.table_tabs;
CREATE POLICY "Store users read table_tabs" ON public.table_tabs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.table_sessions s
      WHERE s.id = table_tabs.session_id
        AND (
          is_store_admin(auth.uid(), s.store_id)
          OR is_platform_admin(auth.uid())
          OR has_store_permission(auth.uid(), s.store_id, 'can_manage_orders')
          OR has_store_permission(auth.uid(), s.store_id, 'can_view_orders')
          OR has_store_permission(auth.uid(), s.store_id, 'can_manage_tables')
        )
    )
  );

-- 5) tab_items
DROP POLICY IF EXISTS "Store users manage tab_items" ON public.tab_items;
CREATE POLICY "Store users manage tab_items" ON public.tab_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.table_tabs t JOIN public.table_sessions s ON s.id = t.session_id
      WHERE t.id = tab_items.tab_id
        AND (
          is_store_admin(auth.uid(), s.store_id)
          OR is_platform_admin(auth.uid())
          OR has_store_permission(auth.uid(), s.store_id, 'can_manage_orders')
          OR has_store_permission(auth.uid(), s.store_id, 'can_manage_tables')
        )
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.table_tabs t JOIN public.table_sessions s ON s.id = t.session_id
      WHERE t.id = tab_items.tab_id
        AND (
          is_store_admin(auth.uid(), s.store_id)
          OR is_platform_admin(auth.uid())
          OR has_store_permission(auth.uid(), s.store_id, 'can_manage_orders')
          OR has_store_permission(auth.uid(), s.store_id, 'can_manage_tables')
        )
    )
  );

DROP POLICY IF EXISTS "Store users read tab_items" ON public.tab_items;
CREATE POLICY "Store users read tab_items" ON public.tab_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.table_tabs t JOIN public.table_sessions s ON s.id = t.session_id
      WHERE t.id = tab_items.tab_id
        AND (
          is_store_admin(auth.uid(), s.store_id)
          OR is_platform_admin(auth.uid())
          OR has_store_permission(auth.uid(), s.store_id, 'can_manage_orders')
          OR has_store_permission(auth.uid(), s.store_id, 'can_view_orders')
          OR has_store_permission(auth.uid(), s.store_id, 'can_manage_tables')
        )
    )
  );

-- 6) orders: permitir Garçom atualizar status dos pedidos de mesa
DROP POLICY IF EXISTS "Store admins or managers can update orders" ON public.orders;
CREATE POLICY "Store admins or managers can update orders" ON public.orders
  FOR UPDATE USING (
    is_store_admin(auth.uid(), store_id)
    OR has_store_permission(auth.uid(), store_id, 'can_manage_orders')
    OR (has_store_permission(auth.uid(), store_id, 'can_manage_tables') AND origem = 'mesa')
    OR is_platform_admin(auth.uid())
  );

-- Garçom também precisa ler os pedidos de mesa que ele criou
DROP POLICY IF EXISTS "Garcom can read mesa orders" ON public.orders;
CREATE POLICY "Garcom can read mesa orders" ON public.orders
  FOR SELECT USING (
    has_store_permission(auth.uid(), store_id, 'can_manage_tables') AND origem = 'mesa'
  );
