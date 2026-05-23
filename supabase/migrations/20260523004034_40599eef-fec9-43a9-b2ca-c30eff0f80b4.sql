
-- 1. restaurant_tables
CREATE TABLE public.restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  number integer NOT NULL,
  label text DEFAULT '',
  seats integer NOT NULL DEFAULT 6,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, number)
);
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active restaurant_tables" ON public.restaurant_tables
  FOR SELECT USING (is_active = true OR is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));
CREATE POLICY "Store admins manage restaurant_tables" ON public.restaurant_tables
  FOR ALL USING (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()))
  WITH CHECK (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));

CREATE TRIGGER trg_restaurant_tables_updated BEFORE UPDATE ON public.restaurant_tables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. table_sessions
CREATE TABLE public.table_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  table_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'aberta',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opened_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uniq_open_session_per_table ON public.table_sessions (table_id) WHERE status = 'aberta';
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store users read table_sessions" ON public.table_sessions
  FOR SELECT USING (
    is_store_admin(auth.uid(), store_id)
    OR is_platform_admin(auth.uid())
    OR has_store_permission(auth.uid(), store_id, 'can_manage_orders')
    OR has_store_permission(auth.uid(), store_id, 'can_view_orders')
  );
CREATE POLICY "Store users insert table_sessions" ON public.table_sessions
  FOR INSERT WITH CHECK (
    is_store_admin(auth.uid(), store_id)
    OR is_platform_admin(auth.uid())
    OR has_store_permission(auth.uid(), store_id, 'can_manage_orders')
  );
CREATE POLICY "Store users update table_sessions" ON public.table_sessions
  FOR UPDATE USING (
    is_store_admin(auth.uid(), store_id)
    OR is_platform_admin(auth.uid())
    OR has_store_permission(auth.uid(), store_id, 'can_manage_orders')
  );
CREATE POLICY "Store admins delete table_sessions" ON public.table_sessions
  FOR DELETE USING (is_store_admin(auth.uid(), store_id) OR is_platform_admin(auth.uid()));

CREATE TRIGGER trg_table_sessions_updated BEFORE UPDATE ON public.table_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. table_tabs
CREATE TABLE public.table_tabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  number integer NOT NULL,
  label text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, number)
);
ALTER TABLE public.table_tabs ENABLE ROW LEVEL SECURITY;

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
        )
    )
  );
CREATE POLICY "Store users manage table_tabs" ON public.table_tabs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.table_sessions s
      WHERE s.id = table_tabs.session_id
        AND (
          is_store_admin(auth.uid(), s.store_id)
          OR is_platform_admin(auth.uid())
          OR has_store_permission(auth.uid(), s.store_id, 'can_manage_orders')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.table_sessions s
      WHERE s.id = table_tabs.session_id
        AND (
          is_store_admin(auth.uid(), s.store_id)
          OR is_platform_admin(auth.uid())
          OR has_store_permission(auth.uid(), s.store_id, 'can_manage_orders')
        )
    )
  );

-- 4. tab_items
CREATE TABLE public.tab_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id uuid NOT NULL,
  product_id uuid,
  variant_id uuid,
  name text NOT NULL,
  code text NOT NULL DEFAULT '',
  unit_price numeric NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  ingredients jsonb NOT NULL DEFAULT '[]'::jsonb,
  removed_ingredients jsonb NOT NULL DEFAULT '[]'::jsonb,
  border jsonb,
  observation text DEFAULT '',
  status text NOT NULL DEFAULT 'pendente',
  paid_order_id uuid,
  image text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tab_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store users read tab_items" ON public.tab_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.table_tabs t
      JOIN public.table_sessions s ON s.id = t.session_id
      WHERE t.id = tab_items.tab_id
        AND (
          is_store_admin(auth.uid(), s.store_id)
          OR is_platform_admin(auth.uid())
          OR has_store_permission(auth.uid(), s.store_id, 'can_manage_orders')
          OR has_store_permission(auth.uid(), s.store_id, 'can_view_orders')
        )
    )
  );
CREATE POLICY "Store users manage tab_items" ON public.tab_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.table_tabs t
      JOIN public.table_sessions s ON s.id = t.session_id
      WHERE t.id = tab_items.tab_id
        AND (
          is_store_admin(auth.uid(), s.store_id)
          OR is_platform_admin(auth.uid())
          OR has_store_permission(auth.uid(), s.store_id, 'can_manage_orders')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.table_tabs t
      JOIN public.table_sessions s ON s.id = t.session_id
      WHERE t.id = tab_items.tab_id
        AND (
          is_store_admin(auth.uid(), s.store_id)
          OR is_platform_admin(auth.uid())
          OR has_store_permission(auth.uid(), s.store_id, 'can_manage_orders')
        )
    )
  );

CREATE TRIGGER trg_tab_items_updated BEFORE UPDATE ON public.tab_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tab_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_sessions;
