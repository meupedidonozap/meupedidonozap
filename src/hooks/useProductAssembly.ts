import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ProductAssembly, AssemblyMode } from '@/types';

function mapAssembly(row: any): ProductAssembly {
  return {
    productId: row.product_id,
    mode: row.mode as AssemblyMode,
    allowObservation: !!row.allow_observation,
    allowBorder: !!row.allow_border,
    limitsByVariant: (row.limits_by_variant || {}) as Record<string, number>,
    defaultIngredientIds: row.default_ingredient_ids || [],
  };
}

export function useProductAssemblies(storeId: string | undefined) {
  return useQuery({
    queryKey: ['product_assembly', storeId],
    queryFn: async () => {
      // join via products to filter by store
      const { data: products } = await (supabase as any)
        .from('products')
        .select('id')
        .eq('store_id', storeId!);
      const ids = (products || []).map((p: any) => p.id);
      if (!ids.length) return [] as ProductAssembly[];
      const { data, error } = await (supabase as any)
        .from('product_assembly')
        .select('*')
        .in('product_id', ids);
      if (error) throw error;
      return (data || []).map(mapAssembly);
    },
    enabled: !!storeId,
    staleTime: 30_000,
  });
}

export function useUpsertProductAssembly() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: ProductAssembly) => {
      const { error } = await (supabase as any).from('product_assembly').upsert({
        product_id: a.productId,
        mode: a.mode,
        allow_observation: a.allowObservation,
        allow_border: a.allowBorder,
        limits_by_variant: a.limitsByVariant,
        default_ingredient_ids: a.defaultIngredientIds,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product_assembly'] }),
  });
}