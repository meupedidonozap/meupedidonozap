import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Ingredient } from '@/types';

function mapIngredient(row: any): Ingredient {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    extraPrice: Number(row.extra_price || 0),
    isActive: row.is_active,
    sortOrder: row.sort_order ?? 0,
    categoryIds: (row.ingredient_categories || []).map((l: any) => l.category_id),
  };
}

export function useIngredients(storeId: string | undefined) {
  return useQuery({
    queryKey: ['ingredients', storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ingredients')
        .select('*, ingredient_categories(category_id)')
        .eq('store_id', storeId!)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []).map(mapIngredient) as Ingredient[];
    },
    enabled: !!storeId,
    staleTime: 30_000,
  });
}

export function useCreateIngredient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { storeId: string; name: string; extraPrice: number; isActive: boolean; categoryIds: string[] }) => {
      const { data, error } = await (supabase as any)
        .from('ingredients')
        .insert({
          store_id: input.storeId,
          name: input.name,
          extra_price: input.extraPrice,
          is_active: input.isActive,
        })
        .select()
        .single();
      if (error) throw error;
      if (input.categoryIds.length) {
        await (supabase as any).from('ingredient_categories').insert(
          input.categoryIds.map(cid => ({ ingredient_id: data.id, category_id: cid }))
        );
      }
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ingredients'] }),
  });
}

export function useUpdateIngredient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name?: string; extraPrice?: number; isActive?: boolean; categoryIds?: string[] }) => {
      const upd: any = {};
      if (input.name !== undefined) upd.name = input.name;
      if (input.extraPrice !== undefined) upd.extra_price = input.extraPrice;
      if (input.isActive !== undefined) upd.is_active = input.isActive;
      if (Object.keys(upd).length) {
        const { error } = await (supabase as any).from('ingredients').update(upd).eq('id', input.id).select().single();
        if (error) throw error;
      }
      if (input.categoryIds !== undefined) {
        await (supabase as any).from('ingredient_categories').delete().eq('ingredient_id', input.id);
        if (input.categoryIds.length) {
          await (supabase as any).from('ingredient_categories').insert(
            input.categoryIds.map(cid => ({ ingredient_id: input.id, category_id: cid }))
          );
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ingredients'] }),
  });
}

export function useDeleteIngredient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('ingredients').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ingredients'] }),
  });
}