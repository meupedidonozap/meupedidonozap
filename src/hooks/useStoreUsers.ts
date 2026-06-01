import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { StorePermissions } from './useStoreAdmin';

export interface StoreUser {
  id: string;
  store_id: string;
  user_id: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  can_view_service_orders: boolean;
  can_manage_service_orders: boolean;
  can_view_orders: boolean;
  can_manage_orders: boolean;
  can_manage_products: boolean;
  can_view_customers: boolean;
  can_manage_tables: boolean;
  seller_codes: string[];
  role: 'auxiliar' | 'vendedor' | 'televendas' | 'garcom';
  seller_id?: string | null;
}

export function useStoreUsers(storeId: string | undefined) {
  return useQuery({
    queryKey: ['store-users', storeId],
    queryFn: async () => {
      if (!storeId) return [];
      const { data, error } = await supabase
        .from('store_users')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as StoreUser[];
    },
    enabled: !!storeId,
  });
}

async function callManage(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sessão expirada');
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-store-user`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro');
  return json;
}

export function useCreateStoreUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      storeId: string;
      email: string;
      password: string;
      name: string;
      permissions: Partial<StorePermissions>;
      sellerCodes?: string[];
      role?: 'auxiliar' | 'vendedor' | 'televendas' | 'garcom';
      sellerId?: string | null;
    }) => {
      return callManage({
        action: 'create',
        storeId: input.storeId,
        email: input.email,
        password: input.password,
        name: input.name,
        permissions: input.permissions,
        sellerCodes: input.sellerCodes ?? [],
        role: input.role ?? 'auxiliar',
        sellerId: input.sellerId ?? null,
      });
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['store-users', vars.storeId] });
    },
  });
}

export function useUpdateStoreUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      storeId: string;
      storeUserId: string;
      name?: string;
      isActive?: boolean;
      permissions?: Partial<StorePermissions>;
      sellerCodes?: string[];
      role?: 'auxiliar' | 'vendedor' | 'televendas' | 'garcom';
      sellerId?: string | null;
    }) => {
      return callManage({
        action: 'update',
        storeId: input.storeId,
        storeUserId: input.storeUserId,
        name: input.name,
        isActive: input.isActive,
        permissions: input.permissions,
        sellerCodes: input.sellerCodes,
        role: input.role,
        sellerId: input.sellerId,
      });
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['store-users', vars.storeId] });
    },
  });
}

export function useDeleteStoreUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { storeId: string; storeUserId: string }) => {
      return callManage({
        action: 'delete',
        storeId: input.storeId,
        storeUserId: input.storeUserId,
      });
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['store-users', vars.storeId] });
    },
  });
}

export function useResetStoreUserPassword() {
  return useMutation({
    mutationFn: async (input: { storeId: string; storeUserId: string; password: string }) => {
      return callManage({
        action: 'reset_password',
        storeId: input.storeId,
        storeUserId: input.storeUserId,
        password: input.password,
      });
    },
  });
}