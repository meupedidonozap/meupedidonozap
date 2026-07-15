import type { Product, ProductVariant } from '@/types';

export type PriceTable = 1 | 4 | 9;

/** Default price table for visitors / unknown customers. */
export const DEFAULT_PRICE_TABLE: PriceTable = 4;

export function normalizePriceTable(value: unknown): PriceTable {
  const n = Number(value);
  if (n === 1 || n === 4 || n === 9) return n as PriceTable;
  return DEFAULT_PRICE_TABLE;
}

/** Resolve a product's price for a given price table, falling back to basePrice. */
export function resolveProductPrice(product: Product | null | undefined, table?: PriceTable): number {
  if (!product) return 0;
  const t = normalizePriceTable(table);
  const candidate =
    t === 1 ? product.priceTable1
    : t === 9 ? product.priceTable9
    : product.priceTable4;
  const value = Number(candidate);
  if (Number.isFinite(value) && value > 0) return value;
  return Number(product.basePrice) || 0;
}

/** Resolve a variant's price for a given price table, falling back to its regular price. */
export function resolveVariantPrice(variant: ProductVariant | null | undefined, table?: PriceTable): number {
  if (!variant) return 0;
  const t = normalizePriceTable(table);
  const candidate =
    t === 1 ? variant.priceTable1
    : t === 9 ? variant.priceTable9
    : variant.priceTable4;
  const value = Number(candidate);
  if (Number.isFinite(value) && value > 0) return value;
  return Number(variant.price) || 0;
}