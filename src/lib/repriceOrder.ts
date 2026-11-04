import { getProductPriceOrNull, getVariantPriceOrNull, type PriceTable } from './pricing';

export interface RepriceResult<T> {
  items: T[];
  /** Itens sem preço na nova tabela (mantidos com o preço antigo). */
  missing: T[];
  changed: number;
}

/**
 * Recalcula o preço unitário de cada item pela tabela escolhida.
 * Itens sem preço na nova tabela permanecem como estão e são listados em `missing`.
 * Os descontos por faixa devem ser recalculados depois com computeGroupDiscounts.
 */
export function repriceItems<T extends { productId: string; variantId?: string; price: number }>(
  items: T[],
  products: any[],
  table: PriceTable,
): RepriceResult<T> {
  const missing: T[] = [];
  let changed = 0;
  const next = items.map(it => {
    const p = products.find(x => x.id === it.productId);
    if (!p) { missing.push(it); return it; }
    const price = it.variantId
      ? getVariantPriceOrNull((p.variants || []).find((v: any) => v.id === it.variantId), table)
      : getProductPriceOrNull(p, table);
    if (price === null) { missing.push(it); return it; }
    if (price !== it.price) changed++;
    return { ...it, price, discountPercent: undefined } as T;
  });
  return { items: next, missing, changed };
}
