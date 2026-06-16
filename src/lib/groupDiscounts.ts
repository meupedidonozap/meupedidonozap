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

/**
 * Retorna uma cópia dos itens com `discountPercent` preenchido a partir das
 * regras de grupo, quando o item ainda não tem um percentual gravado.
 * Útil na impressão/exportação de pedidos antigos cujos itens foram salvos
 * sem o campo `discountPercent` em todas as linhas.
 */
export function ensureItemDiscountPercents<T extends CartItem & { discountPercent?: number }>(
  items: T[],
  rules: DiscountRule[] | undefined,
): T[] {
  if (!rules || rules.length === 0) return items;
  const { itemDiscounts } = computeGroupDiscounts(items, rules);
  return items.map(it => {
    if (it.discountPercent && it.discountPercent > 0) return it;
    const key = `${it.productId}-${it.variantId || ''}`;
    const pct = itemDiscounts[key];
    if (!pct) return it;
    return { ...it, discountPercent: pct };
  });
}