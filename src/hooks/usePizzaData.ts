import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PizzaSize, PizzaFlavor } from '@/types';

function mapSize(row: any): PizzaSize {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    maxFlavors: row.max_flavors,
    price: Number(row.price),
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

function mapFlavor(row: any): PizzaFlavor {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    description: row.description || '',
    imageUrl: row.image_url || undefined,
    categoryId: row.category_id || undefined,
    isActive: row.is_active,
  };
}

export function usePizzaSizes(storeId: string | undefined) {
  return useQuery({
    queryKey: ['pizza_sizes', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pizza_sizes')
        .select('*')
        .eq('store_id', storeId!)
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return (data || []).map(mapSize);
    },
    enabled: !!storeId,
    staleTime: 30_000,
  });
}

export function usePizzaFlavors(storeId: string | undefined) {
  return useQuery({
    queryKey: ['pizza_flavors', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pizza_flavors')
        .select('*')
        .eq('store_id', storeId!)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []).map(mapFlavor);
    },
    enabled: !!storeId,
    staleTime: 30_000,
  });
}
