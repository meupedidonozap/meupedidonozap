import type { CartItem, DiscountRule } from '@/types';

export function computeGroupDiscounts(
  items: CartItem[],
  rules: DiscountRule[]
): { quantityDiscount: number; itemDiscounts: Record<string, number> } {
  const groupRules = rules.filter(r => r.type === 'group');
  let totalDiscount = 0;
  const itemDiscounts: Record<string, number> = {};

  if (groupRules.length === 0) return { quantityDiscount: 0, itemDiscounts };

  const groupMap = new Map<string, CartItem[]>();
  for (const item of items) {
    if (!item.groupId) continue;
    const list = groupMap.get(item.groupId) || [];
    list.push(item);
    groupMap.set(item.groupId, list);
  }

  for (const [groupId, groupItems] of groupMap) {
    const totalQty = groupItems.reduce((s, i) => s + i.quantity, 0);
    const applicable = groupRules
      .filter(r => r.groupId === groupId && (r.minQuantity || 0) <= totalQty)
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