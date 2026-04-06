import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StoreSeller {
  id: string;
  store_id: string;
  name: string;
  whatsapp: string;
  is_active: boolean;
  created_at: string;
}

export function useStoreSellers(storeId: string | undefined) {
  return useQuery({
    queryKey: ['store-sellers', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_sellers')
        .select('*')
        .eq('store_id', storeId!)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as StoreSeller[];
    },
    enabled: !!storeId,
  });
}

export function useAllStoreSellers(storeId: string | undefined) {
  return useQuery({
    queryKey: ['store-sellers-all', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_sellers')
        .select('*')
        .eq('store_id', storeId!)
        .order('name');
      if (error) throw error;
      return (data || []) as StoreSeller[];
    },
    enabled: !!storeId,
  });
}

export function useCreateStoreSeller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (seller: { store_id: string; name: string; whatsapp: string }) => {
      const { data, error } = await supabase
        .from('store_sellers')
        .insert(seller)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['store-sellers', vars.store_id] });
      qc.invalidateQueries({ queryKey: ['store-sellers-all', vars.store_id] });
    },
  });
}

export function useUpdateStoreSeller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; whatsapp?: string; is_active?: boolean }) => {
      const { data, error } = await supabase
        .from('store_sellers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as StoreSeller;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['store-sellers', data.store_id] });
      qc.invalidateQueries({ queryKey: ['store-sellers-all', data.store_id] });
    },
  });
}

export function useDeleteStoreSeller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, storeId }: { id: string; storeId: string }) => {
      const { error } = await supabase
        .from('store_sellers')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return storeId;
    },
    onSuccess: (storeId) => {
      qc.invalidateQueries({ queryKey: ['store-sellers', storeId] });
      qc.invalidateQueries({ queryKey: ['store-sellers-all', storeId] });
    },
  });
}
