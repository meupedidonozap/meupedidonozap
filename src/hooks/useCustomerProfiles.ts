import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CustomerProfile } from './useCustomerProfile';

function mapProfile(row: any): CustomerProfile & { isActive: boolean; customerCode: string } {
  return {
    id: row.id,
    userId: row.user_id,
    storeId: row.store_id,
    name: row.name,
    cpfCnpj: row.cpf_cnpj,
    whatsapp: row.whatsapp,
    cep: row.cep,
    uf: row.uf,
    city: row.city,
    neighborhood: row.neighborhood,
    address: row.address,
    number: row.number,
    complement: row.complement || undefined,
    sellerCode: row.seller_code || '',
    isActive: row.is_active ?? true,
    customerCode: row.customer_code || '',
  };
}

export function useStoreCustomerProfiles(storeId: string | undefined) {
  return useQuery({
    queryKey: ['store-customer-profiles', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('store_id', storeId!)
        .order('name');
      if (error) throw error;
      return (data || []).map(mapProfile);
    },
    enabled: !!storeId,
    staleTime: 30_000,
  });
}

export function useCreateCustomerProfileAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      storeId: string;
      name: string;
      whatsapp?: string;
      cep?: string;
      uf?: string;
      city?: string;
      neighborhood?: string;
      address?: string;
      number?: string;
      complement?: string;
      cpfCnpj?: string;
      sellerCode?: string;
    }) => {
      const { error } = await supabase
        .from('customer_profiles')
        .insert({
          store_id: params.storeId,
          name: params.name,
          whatsapp: params.whatsapp || '',
          cep: params.cep || '',
          uf: params.uf || '',
          city: params.city || '',
          neighborhood: params.neighborhood || '',
          address: params.address || '',
          number: params.number || '',
          complement: params.complement || null,
          cpf_cnpj: params.cpfCnpj || '',
          seller_code: params.sellerCode || '',
        } as any);
      if (error) throw error;
    },
    onSuccess: (_, params) => {
      qc.invalidateQueries({ queryKey: ['store-customer-profiles', params.storeId] });
    },
  });
}

export function useUpdateCustomerProfileAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      storeId: string;
      name?: string;
      whatsapp?: string;
      cep?: string;
      uf?: string;
      city?: string;
      neighborhood?: string;
      address?: string;
      number?: string;
      complement?: string;
      cpfCnpj?: string;
      sellerCode?: string;
    }) => {
      const update: any = {};
      if (params.name !== undefined) update.name = params.name;
      if (params.whatsapp !== undefined) update.whatsapp = params.whatsapp;
      if (params.cep !== undefined) update.cep = params.cep;
      if (params.uf !== undefined) update.uf = params.uf;
      if (params.city !== undefined) update.city = params.city;
      if (params.neighborhood !== undefined) update.neighborhood = params.neighborhood;
      if (params.address !== undefined) update.address = params.address;
      if (params.number !== undefined) update.number = params.number;
      if (params.complement !== undefined) update.complement = params.complement;
      if (params.cpfCnpj !== undefined) update.cpf_cnpj = params.cpfCnpj;
      if (params.sellerCode !== undefined) update.seller_code = params.sellerCode;

      const { error } = await supabase
        .from('customer_profiles')
        .update(update)
        .eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: (_, params) => {
      qc.invalidateQueries({ queryKey: ['store-customer-profiles', params.storeId] });
    },
  });
}

export function useToggleCustomerActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive, storeId }: { id: string; isActive: boolean; storeId: string }) => {
      const { error } = await supabase
        .from('customer_profiles')
        .update({ is_active: isActive } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, params) => {
      qc.invalidateQueries({ queryKey: ['store-customer-profiles', params.storeId] });
    },
  });
}

export function useDeleteCustomerProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, storeId }: { id: string; storeId: string }) => {
      const { error } = await supabase
        .from('customer_profiles')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, params) => {
      qc.invalidateQueries({ queryKey: ['store-customer-profiles', params.storeId] });
    },
  });
}

export async function checkCustomerHasOrders(customerName: string, storeId: string, userId?: string): Promise<boolean> {
  // Check orders
  const orderQuery = supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId);

  if (userId) {
    // If customer has a user_id, check by user_id
    const { count: c1 } = await orderQuery.eq('user_id', userId);
    if (c1 && c1 > 0) return true;
  }

  // Also check by customer name in JSONB
  const { count: c2 } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .filter('customer->>name', 'eq', customerName);
  if (c2 && c2 > 0) return true;

  // Check service_orders
  if (userId) {
    const { count: c3 } = await supabase
      .from('service_orders')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .eq('user_id', userId);
    if (c3 && c3 > 0) return true;
  }

  const { count: c4 } = await supabase
    .from('service_orders')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .filter('customer->>name', 'eq', customerName);
  if (c4 && c4 > 0) return true;

  return false;
}
