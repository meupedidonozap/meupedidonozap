import type { CartItem, DiscountRule } from '@/types';
import { normalizePriceTable, type PriceTable } from '@/lib/pricing';

function normalizeGroupId(raw: string | undefined | null): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  // Strip leading "XX - " prefix (digits or alphanumeric code, e.g. "32 - " or "P20 - ")
  const m = s.match(/^\s*[A-Za-z0-9]+\s*-\s*(.+)$/);
  const base = (m ? m[1] : s).trim();
  return base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function computeGroupDiscounts(
  items: CartItem[],
  rules: DiscountRule[],
  customerPriceTable?: PriceTable,
): { quantityDiscount: number; itemDiscounts: Record<string, number> } {
  const effectiveTable: PriceTable = normalizePriceTable(customerPriceTable);
  const groupRules = rules.filter(r => {
    if (r.type !== 'group') return false;
    // Rules with no priceTable = universal. Otherwise must match the customer's table.
    if (r.priceTable == null) return true;
    return r.priceTable === effectiveTable;
  });
  let totalDiscount = 0;
  const itemDiscounts: Record<string, number> = {};

  if (groupRules.length === 0) return { quantityDiscount: 0, itemDiscounts };

  // Prioridade: produto > grupo > categoria. Cada item recebe só uma regra.
  const scopeOf = (r: DiscountRule) => r.scope || 'group';
  const keyFor = (scope: string, item: CartItem): string => {
    if (scope === 'product') return item.productId || '';
    if (scope === 'category') return item.categoryId || '';
    return normalizeGroupId(item.groupId);
  };
  const ruleKey = (r: DiscountRule): string => {
    const sc = scopeOf(r);
    if (sc === 'product') return r.productId || '';
    if (sc === 'category') return r.categoryId || '';
    return normalizeGroupId(r.groupId);
  };
  const chosen = new Map<CartItem, number>();
  for (const scope of ['product', 'group', 'category'] as const) {
    const scoped = groupRules.filter(r => scopeOf(r) === scope);
    if (scoped.length === 0) continue;
    const buckets = new Map<string, CartItem[]>();
    for (const item of items) {
      if (chosen.has(item)) continue;
      const k = keyFor(scope, item);
      if (!k) continue;
      const list = buckets.get(k) || [];
      list.push(item);
      buckets.set(k, list);
    }
    for (const [k, bucketItems] of buckets) {
      const totalQty = bucketItems.reduce((s, i) => s + i.quantity, 0);
      const applicable = scoped
        .filter(r => ruleKey(r) === k && (r.minQuantity || 0) <= totalQty)
        .sort((a, b) => (b.minQuantity || 0) - (a.minQuantity || 0))[0];
      if (!applicable) continue;
      for (const item of bucketItems) chosen.set(item, applicable.discountPercent);
    }
  }
  for (const [item, pctValue] of chosen) {
    const key = `${item.productId}-${item.variantId || ''}`;
    itemDiscounts[key] = pctValue;
    totalDiscount += item.price * item.quantity * (pctValue / 100);
  }

  return { quantityDiscount: totalDiscount, itemDiscounts };
}

/**
 * Retorna uma cópia dos itens com `discountPercent` preenchido a partir das
 * regras de grupo, quando o item ainda não tem um percentual gravado.
 * Útil na impressão/exportação de pedidos antigos cujos itens foram salvos
 * sem o campo `discountPercent` em todas as linhas.
 */
export function ensureItemDiscountPercents<T extends CartItem & { discountPercent?: number }>(
  items: T[],
  rules: DiscountRule[] | undefined,
  customerPriceTable?: PriceTable,
): T[] {
  if (!rules || rules.length === 0) return items;
  const { itemDiscounts } = computeGroupDiscounts(items, rules, customerPriceTable);
  return items.map(it => {
    if (it.discountPercent && it.discountPercent > 0) return it;
    const key = `${it.productId}-${it.variantId || ''}`;
    const pct = itemDiscounts[key];
    if (!pct) return it;
    return { ...it, discountPercent: pct };
  });
}