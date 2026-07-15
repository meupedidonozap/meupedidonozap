import type { CartItem, DiscountRule } from '@/types';

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
  customerPriceTable?: 1 | 4 | 9,
): { quantityDiscount: number; itemDiscounts: Record<string, number> } {
  const effectiveTable: 1 | 4 | 9 = (customerPriceTable === 1 || customerPriceTable === 9 || customerPriceTable === 4)
    ? customerPriceTable
    : 4;
  const groupRules = rules.filter(r => {
    if (r.type !== 'group') return false;
    // Rules with no priceTable = universal. Otherwise must match the customer's table.
    if (r.priceTable == null) return true;
    return r.priceTable === effectiveTable;
  });
  let totalDiscount = 0;
  const itemDiscounts: Record<string, number> = {};

  if (groupRules.length === 0) return { quantityDiscount: 0, itemDiscounts };

  const groupMap = new Map<string, CartItem[]>();
  for (const item of items) {
    if (!item.groupId) continue;
    const key = normalizeGroupId(item.groupId);
    if (!key) continue;
    const list = groupMap.get(key) || [];
    list.push(item);
    groupMap.set(key, list);
  }

  for (const [groupKey, groupItems] of groupMap) {
    const totalQty = groupItems.reduce((s, i) => s + i.quantity, 0);
    const applicable = groupRules
      .filter(r => normalizeGroupId(r.groupId) === groupKey && (r.minQuantity || 0) <= totalQty)
      .sort((a, b) => (b.minQuantity || 0) - (a.minQuantity || 0))[0];

    if (!applicable) continue;

    const pct = applicable.discountPercent / 100;
    for (const item of groupItems) {
      const key = `${item.productId}-${item.variantId || ''}`;
      itemDiscounts[key] = applicable.discountPercent;
      totalDiscount += item.price * item.quantity * pct;
    }
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
  customerPriceTable?: 1 | 4 | 9,
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