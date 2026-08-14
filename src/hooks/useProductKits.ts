import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { KitComponent, KitMap } from '@/lib/kitExpansion';
import { normalizePriceTable, type PriceTable } from '@/lib/pricing';

export interface KitItemRow {
  id: string;
  componentProductId: string;
  code: string;
  name: string;
  quantity: number;
  fullPrice: number;
}

function componentPrice(row: any, table: PriceTable): number {
  if (table === 1) return Number(row?.price_table_1) || 0;
  if (table === 9) return Number(row?.price_table_9) || 0;
  if (table === 11) return Number(row?.price_table_11) || 0;
  const t4 = row?.price_table_4;
  if (t4 == null) return Number(row?.base_price) || 0;
  return Number(t4) || 0;
}

const SELECT = `id, kit_product_id, component_product_id, quantity, sort_order,
  kit:products!product_kit_items_kit_product_id_fkey!inner(store_id),
  component:products!product_kit_items_component_product_id_fkey(id, code, name, base_price, price_table_1, price_table_4, price_table_9, price_table_11)`;

/** Mapa de composição dos kits da loja (id do kit -> componentes). */
export function useStoreKitMap(storeId?: string, priceTable?: number) {
  const table = normalizePriceTable(priceTable);
  return useQuery({
    queryKey: ['kit-map', storeId, table],
    enabled: !!storeId,
    staleTime: 30_000,
    queryFn: async (): Promise<KitMap> => {
      const { data, error } = await supabase
        .from('product_kit_items')
        .select(SELECT)
        .eq('kit.store_id', storeId!)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      const map: KitMap = {};
      for (const row of (data || []) as any[]) {
        const c = row.component;
        if (!c) continue;
        const comp: KitComponent = {
          productId: c.id,
          code: c.code || '',
          name: c.name || '',
          quantity: Number(row.quantity) || 0,
          fullPrice: componentPrice(c, table),
        };
        (map[row.kit_product_id] ||= []).push(comp);
      }
      return map;
    },
  });
}

/** Composição de um kit específico (para o cadastro). */
export function useKitItems(kitProductId?: string) {
  return useQuery({
    queryKey: ['kit-items', kitProductId],
    enabled: !!kitProductId,
    queryFn: async (): Promise<KitItemRow[]> => {
      const { data, error } = await supabase
        .from('product_kit_items')
        .select(`id, component_product_id, quantity, sort_order,
          component:products!product_kit_items_component_product_id_fkey(id, code, name, base_price, price_table_1, price_table_4, price_table_9, price_table_11)`)
        .eq('kit_product_id', kitProductId!)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return ((data || []) as any[]).map(row => ({
        id: row.id,
        componentProductId: row.component_product_id,
        code: row.component?.code || '',
        name: row.component?.name || '',
        quantity: Number(row.quantity) || 1,
        fullPrice: componentPrice(row.component, 4),
      }));
    },
  });
}

export interface SaveKitInput {
  kitProductId: string;
  isKit: boolean;
  items: { componentProductId: string; quantity: number }[];
}

/** Regrava a composição inteira do kit. */
export function useSaveKitItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ kitProductId, isKit, items }: SaveKitInput) => {
      const { error: delError } = await supabase
        .from('product_kit_items')
        .delete()
        .eq('kit_product_id', kitProductId);
      if (delError) throw delError;

      if (isKit && items.length > 0) {
        const rows = items.map((it, idx) => ({
          kit_product_id: kitProductId,
          component_product_id: it.componentProductId,
          quantity: Math.max(1, Number(it.quantity) || 1),
          sort_order: idx,
        }));
        const { error } = await supabase.from('product_kit_items').insert(rows);
        if (error) throw error;
      }

      const { error: prodError } = await supabase
        .from('products')
        .update({ is_kit: isKit && items.length > 0 })
        .eq('id', kitProductId);
      if (prodError) throw prodError;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['kit-items', vars.kitProductId] });
      qc.invalidateQueries({ queryKey: ['kit-map'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
