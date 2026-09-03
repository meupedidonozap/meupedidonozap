import type { Product, ProductVariant } from '@/types';

export type PriceTable = 1 | 4 | 9 | 11;

export const PRICE_TABLES: PriceTable[] = [1, 4, 9, 11];

/** Default price table for visitors / unknown customers. */
export const DEFAULT_PRICE_TABLE: PriceTable = 4;

export function normalizePriceTable(value: unknown, fallback: PriceTable = DEFAULT_PRICE_TABLE): PriceTable {
  const n = Number(value);
  if (n === 1 || n === 4 || n === 9 || n === 11) return n as PriceTable;
  return fallback;
}

/** Tabela padrão da loja quando o cliente não tem tabela definida. */
export function storeDefaultPriceTable(slug?: string | null): PriceTable {
  return slug === 'dicoloresenses' ? 11 : DEFAULT_PRICE_TABLE;
}

/**
 * Tabela de preço efetiva da loja para um cliente.
 * DiColore Senses opera exclusivamente na tabela 11 (visitante, cliente
 * cadastrado, Modo Vendedor, pedido manual e exportação).
 */
export function resolveStorePriceTable(slug?: string | null, customerTable?: unknown): PriceTable {
  if (slug === 'dicoloresenses') return 11;
  return normalizePriceTable(customerTable, storeDefaultPriceTable(slug));
}

function positive(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Price of a product for a given table, or null when unavailable.
 * Zero/empty on tables 1 and 9 means "not sold for this table" (no fallback).
 * Table 4 (default for every other store type) still falls back to basePrice
 * when the column was never filled — an explicit 0 keeps it unavailable.
 */
export function getProductPriceOrNull(product: Product | null | undefined, table?: PriceTable): number | null {
  if (!product) return null;
  const t = normalizePriceTable(table);
  if (t === 1) return positive(product.priceTable1);
  if (t === 9) return positive(product.priceTable9);
  if (t === 11) {
    if (product.priceTable11 == null) {
      return positive(product.priceTable4) ?? positive(product.basePrice);
    }
    return positive(product.priceTable11);
  }
  if (product.priceTable4 == null) return positive(product.basePrice);
  return positive(product.priceTable4);
}

/** Price of a variant for a given table, or null when unavailable. */
export function getVariantPriceOrNull(variant: ProductVariant | null | undefined, table?: PriceTable): number | null {
  if (!variant) return null;
  const t = normalizePriceTable(table);
  if (t === 1) return positive(variant.priceTable1);
  if (t === 9) return positive(variant.priceTable9);
  if (t === 11) {
    if (variant.priceTable11 == null) {
      return positive(variant.priceTable4) ?? positive(variant.price);
    }
    return positive(variant.priceTable11);
  }
  if (variant.priceTable4 == null) return positive(variant.price);
  return positive(variant.priceTable4);
}

/** Resolve a product's price for a given price table (0 when unavailable). */
export function resolveProductPrice(product: Product | null | undefined, table?: PriceTable): number {
  return getProductPriceOrNull(product, table) ?? 0;
}

/** Resolve a variant's price for a given price table (0 when unavailable). */
export function resolveVariantPrice(variant: ProductVariant | null | undefined, table?: PriceTable): number {
  return getVariantPriceOrNull(variant, table) ?? 0;
}

/**
 * Estoque disponível do item. Produtos com variação usam o estoque da
 * variação; os demais usam o estoque do próprio produto.
 * Produtos sem controle de estoque (campo ausente) são considerados disponíveis.
 */
export function hasStock(
  product: Product | null | undefined,
  variant?: ProductVariant | null,
  enabled: boolean = true,
): boolean {
  if (!product) return false;
  if (!enabled) return true;
  if (variant) return Number(variant.stock ?? 0) > 0;
  if (product.stock == null) return true;
  return Number(product.stock) > 0;
}