import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FoodItem } from '@/types';

function mapFoodItem(row: any): FoodItem {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    description: row.description || '',
    categoryId: row.category_id || '',
    price: Number(row.price),
    image: row.image_url || undefined,
    isActive: row.is_active,
    preparationTime: row.preparation_time,
  };
}

export function useFoodItems(storeId: string | undefined) {
  return useQuery({
    queryKey: ['food_items', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('food_items')
        .select('*')
        .eq('store_id', storeId!)
        .order('name');
      if (error) throw error;
      return (data || []).map(mapFoodItem);
    },
    enabled: !!storeId,
    staleTime: 30_000,
  });
}

export function useCreateFoodItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Omit<FoodItem, 'id' | 'additions'>) => {
      const { error } = await supabase.from('food_items').insert({
        store_id: item.storeId,
        name: item.name,
        description: item.description,
        category_id: item.categoryId || null,
        price: item.price,
        image_url: item.image || null,
        is_active: item.isActive,
        preparation_time: item.preparationTime,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['food_items'] }),
  });
}

export function useUpdateFoodItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FoodItem> & { id: string }) => {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.categoryId !== undefined) dbUpdates.category_id = updates.categoryId;
      if (updates.price !== undefined) dbUpdates.price = updates.price;
      if (updates.image !== undefined) dbUpdates.image_url = updates.image;
      if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
      if (updates.preparationTime !== undefined) dbUpdates.preparation_time = updates.preparationTime;
      const { error } = await supabase.from('food_items').update(dbUpdates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['food_items'] }),
  });
}

export function useDeleteFoodItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('food_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['food_items'] }),
  });
}
