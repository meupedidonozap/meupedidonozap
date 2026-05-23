import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { RestaurantTable, TableSession, TableTab, TabItem } from '@/types';

const mapTable = (r: any): RestaurantTable => ({
  id: r.id, storeId: r.store_id, number: r.number, label: r.label || '',
  seats: r.seats, isActive: r.is_active,
});
const mapSession = (r: any): TableSession => ({
  id: r.id, storeId: r.store_id, tableId: r.table_id, status: r.status,
  openedAt: r.opened_at, closedAt: r.closed_at, openedBy: r.opened_by,
});
const mapTab = (r: any): TableTab => ({
  id: r.id, sessionId: r.session_id, number: r.number, label: r.label || '', createdAt: r.created_at,
});
const mapItem = (r: any): TabItem => ({
  id: r.id, tabId: r.tab_id, productId: r.product_id, variantId: r.variant_id,
  name: r.name, code: r.code, unitPrice: Number(r.unit_price || 0), quantity: r.quantity,
  ingredients: r.ingredients || [], removedIngredients: r.removed_ingredients || [],
  border: r.border || undefined, observation: r.observation || '',
  status: r.status, paidOrderId: r.paid_order_id, image: r.image, createdAt: r.created_at,
});

export function useTables(storeId?: string) {
  return useQuery({
    queryKey: ['restaurant_tables', storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('restaurant_tables').select('*').eq('store_id', storeId!).order('number');
      if (error) throw error;
      return (data || []).map(mapTable) as RestaurantTable[];
    },
    enabled: !!storeId,
  });
}

export function useCreateTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { storeId: string; number: number; label?: string; seats?: number }) => {
      const { data, error } = await (supabase as any).from('restaurant_tables').insert({
        store_id: input.storeId, number: input.number, label: input.label || '', seats: input.seats ?? 6,
      }).select().single();
      if (error) throw error;
      return mapTable(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['restaurant_tables'] }),
  });
}
export function useUpdateTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; number?: number; label?: string; seats?: number; isActive?: boolean }) => {
      const upd: any = {};
      if (input.number !== undefined) upd.number = input.number;
      if (input.label !== undefined) upd.label = input.label;
      if (input.seats !== undefined) upd.seats = input.seats;
      if (input.isActive !== undefined) upd.is_active = input.isActive;
      const { error } = await (supabase as any).from('restaurant_tables').update(upd).eq('id', input.id).select().single();
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['restaurant_tables'] }),
  });
}
export function useDeleteTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('restaurant_tables').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['restaurant_tables'] }),
  });
}

// Sessions
export function useOpenSessions(storeId?: string) {
  return useQuery({
    queryKey: ['table_sessions', storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('table_sessions').select('*').eq('store_id', storeId!).eq('status', 'aberta');
      if (error) throw error;
      return (data || []).map(mapSession) as TableSession[];
    },
    enabled: !!storeId,
    refetchInterval: 15_000,
  });
}

export function useOpenTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { storeId: string; tableId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any).from('table_sessions').insert({
        store_id: input.storeId, table_id: input.tableId, status: 'aberta', opened_by: user?.id,
      }).select().single();
      if (error) throw error;
      // create default tab #1
      await (supabase as any).from('table_tabs').insert({ session_id: data.id, number: 1, label: '' });
      return mapSession(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['table_sessions'] });
      qc.invalidateQueries({ queryKey: ['table_tabs'] });
    },
  });
}

export function useCloseSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await (supabase as any).from('table_sessions')
        .update({ status: 'fechada', closed_at: new Date().toISOString() })
        .eq('id', sessionId).select().single();
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['table_sessions'] });
    },
  });
}

// Tabs
export function useTabs(sessionId?: string) {
  return useQuery({
    queryKey: ['table_tabs', sessionId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('table_tabs').select('*').eq('session_id', sessionId!).order('number');
      if (error) throw error;
      return (data || []).map(mapTab) as TableTab[];
    },
    enabled: !!sessionId,
  });
}

export function useAddTab() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sessionId: string; number: number; label?: string }) => {
      const { data, error } = await (supabase as any).from('table_tabs').insert({
        session_id: input.sessionId, number: input.number, label: input.label || '',
      }).select().single();
      if (error) throw error;
      return mapTab(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['table_tabs'] }),
  });
}

// Items
export function useTabItems(sessionId?: string) {
  return useQuery({
    queryKey: ['tab_items', sessionId],
    queryFn: async () => {
      // get all tab ids for the session
      const { data: tabs, error: e1 } = await (supabase as any)
        .from('table_tabs').select('id').eq('session_id', sessionId!);
      if (e1) throw e1;
      const tabIds = (tabs || []).map((t: any) => t.id);
      if (!tabIds.length) return [] as TabItem[];
      const { data, error } = await (supabase as any)
        .from('tab_items').select('*').in('tab_id', tabIds).order('created_at');
      if (error) throw error;
      return (data || []).map(mapItem) as TabItem[];
    },
    enabled: !!sessionId,
    refetchInterval: 10_000,
  });
}

export function useAddTabItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<TabItem, 'id' | 'createdAt' | 'status' | 'paidOrderId'> & { status?: string }) => {
      const { data, error } = await (supabase as any).from('tab_items').insert({
        tab_id: input.tabId,
        product_id: input.productId,
        variant_id: input.variantId,
        name: input.name,
        code: input.code,
        unit_price: input.unitPrice,
        quantity: input.quantity,
        ingredients: input.ingredients,
        removed_ingredients: input.removedIngredients,
        border: input.border,
        observation: input.observation || '',
        status: input.status || 'pendente',
        image: input.image,
      }).select().single();
      if (error) throw error;
      return mapItem(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tab_items'] }),
  });
}

export function useUpdateTabItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status?: string; quantity?: number; paidOrderId?: string }) => {
      const upd: any = {};
      if (input.status !== undefined) upd.status = input.status;
      if (input.quantity !== undefined) upd.quantity = input.quantity;
      if (input.paidOrderId !== undefined) upd.paid_order_id = input.paidOrderId;
      const { error } = await (supabase as any).from('tab_items').update(upd).eq('id', input.id).select().single();
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tab_items'] }),
  });
}

export function useDeleteTabItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('tab_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tab_items'] }),
  });
}