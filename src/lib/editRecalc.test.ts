import { describe, it, expect } from 'vitest';
import { refreshItemsFromCatalog } from './editRecalc';
import { computeGroupDiscounts } from './groupDiscounts';

describe('recalculo ao editar', () => {
  it('usa preço atual e regra vigente: R$25 com 5% = R$23,75', () => {
    const items: any[] = [{ productId: 'p', name: 'X', price: 20, quantity: 6, discountPercent: 30, groupId: 'old' }];
    const products = [{ id: 'p', priceTable4: 25, groupId: 'COR', categoryId: 'c', variants: [] }];
    const r = refreshItemsFromCatalog(items, products, 4);
    expect(r.items[0].price).toBe(25);
    expect(r.items[0].discountPercent).toBeUndefined();
    const d = computeGroupDiscounts(r.items, [{ type: 'group', groupId: 'COR', minQuantity: 6, discountPercent: 5 } as any], 4);
    expect(25 * (1 - d.itemDiscounts['p-'] / 100)).toBeCloseTo(23.75);
  });
});
