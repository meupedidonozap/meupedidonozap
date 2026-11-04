import { describe, it, expect } from 'vitest';
import { repriceItems } from './repriceOrder';

const products = [
  { id: 'a', priceTable1: 10, priceTable9: 12, basePrice: 15 },
  { id: 'b', priceTable1: 20, priceTable9: 0, basePrice: 25 },
];

describe('repriceItems', () => {
  it('troca da tabela 1 para a 9 usa o preço da tabela 9', () => {
    const r = repriceItems([{ productId: 'a', price: 10 }], products, 9);
    expect(r.items[0].price).toBe(12);
    expect(r.changed).toBe(1);
  });
  it('item sem preço na nova tabela fica listado e mantém o preço antigo', () => {
    const r = repriceItems([{ productId: 'b', price: 20 }], products, 9);
    expect(r.missing).toHaveLength(1);
    expect(r.items[0].price).toBe(20);
  });
});
