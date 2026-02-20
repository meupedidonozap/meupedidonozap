import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Category } from '@/types';

function mapCategory(row: any): Category {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    order: row.sort_order,
  };
}

export function useCategories(storeId: string | undefined) {
  return useQuery({
    queryKey: ['categories', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('store_id', storeId!)
        .order('sort_order');
      if (error) throw error;
      return (data || []).map(mapCategory);
    },
    enabled: !!storeId,
    staleTime: 30_000,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cat: { storeId: string; name: string; order?: number }) => {
      const { error } = await supabase.from('categories').insert({
        store_id: cat.storeId,
        name: cat.name,
        sort_order: cat.order || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, order }: { id: string; name?: string; order?: number }) => {
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (order !== undefined) updates.sort_order = order;
      const { error } = await supabase.from('categories').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}
