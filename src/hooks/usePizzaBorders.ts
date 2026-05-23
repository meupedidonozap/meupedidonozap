import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PizzaBorder } from '@/types';

function mapBorder(row: any): PizzaBorder {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    price: Number(row.price || 0),
    isActive: row.is_active,
    sortOrder: row.sort_order ?? 0,
  };
}

export function usePizzaBorders(storeId: string | undefined) {
  return useQuery({
    queryKey: ['pizza_borders', storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('pizza_borders')
        .select('*')
        .eq('store_id', storeId!)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []).map(mapBorder) as PizzaBorder[];
    },
    enabled: !!storeId,
    staleTime: 30_000,
  });
}

export function useCreatePizzaBorder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { storeId: string; name: string; price: number; isActive: boolean }) => {
      const { error } = await (supabase as any).from('pizza_borders').insert({
        store_id: input.storeId,
        name: input.name,
        price: input.price,
        is_active: input.isActive,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pizza_borders'] }),
  });
}

export function useUpdatePizzaBorder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name?: string; price?: number; isActive?: boolean }) => {
      const upd: any = {};
      if (input.name !== undefined) upd.name = input.name;
      if (input.price !== undefined) upd.price = input.price;
      if (input.isActive !== undefined) upd.is_active = input.isActive;
      const { error } = await (supabase as any).from('pizza_borders').update(upd).eq('id', input.id).select().single();
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pizza_borders'] }),
  });
}

export function useDeletePizzaBorder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('pizza_borders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pizza_borders'] }),
  });
}