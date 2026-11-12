import { supabase } from '@/integrations/supabase/client';
import { mapProduct } from '@/hooks/useProducts';
import { getProductPriceOrNull, getVariantPriceOrNull, type PriceTable } from '@/lib/pricing';
import type { CartItem } from '@/types';

/**
 * Atualiza itens de um pedido/orçamento com o catálogo atual antes da edição:
 * preço da tabela, grupo e categoria (usados nas regras de desconto).
 * O percentual de desconto é sempre limpo para ser recalculado pelas regras vigentes.
 */
export function refreshItemsFromCatalog(items: CartItem[], products: any[], table: PriceTable) {
  let changed = 0;
  const next = items.map(it => {
    const p = products.find(x => x.id === it.productId);
    const base = { ...it, discountPercent: undefined } as CartItem;
    if (!p) return base;
    const price = it.variantId
      ? getVariantPriceOrNull((p.variants || []).find((v: any) => v.id === it.variantId), table)
      : getProductPriceOrNull(p, table);
    const out: CartItem = {
      ...base,
      price: price ?? it.price,
      groupId: p.groupId ?? it.groupId,
      categoryId: p.categoryId || it.categoryId,
    };
    if (out.price !== it.price || out.groupId !== it.groupId || out.categoryId !== it.categoryId) changed++;
    return out;
  });
  return { items: next, changed };
}

export async function loadItemsForEdit(storeId: string, items: any[], table: PriceTable) {
  const valid = (items || []).filter(i => i?.productId) as CartItem[];
  const ids = [...new Set(valid.map(i => i.productId))];
  if (!ids.length) return { items: valid, changed: 0 };
  const { data, error } = await supabase
    .from('products').select('*, product_variants(*)').eq('store_id', storeId).in('id', ids);
  if (error) throw error;
  return refreshItemsFromCatalog(valid, (data || []).map(mapProduct), table);
}
