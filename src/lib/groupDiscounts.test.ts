import { describe, it, expect } from 'vitest';
import { computeGroupDiscounts } from './groupDiscounts';
import type { CartItem, DiscountRule } from '@/types';

const item = (o: Partial<CartItem>): CartItem => ({ productId: 'p1', name: 'x', code: 'x', price: 100, quantity: 1, ...o });
const rule = (o: Partial<DiscountRule>): DiscountRule => ({ id: Math.random().toString(), type: 'group', discountPercent: 10, description: '', minQuantity: 1, ...o });

describe('descontos por categoria, grupo e produto', () => {
  it('aplica por categoria do cadastro do produto', () => {
    const r = computeGroupDiscounts([item({ categoryId: 'c1', quantity: 2 })], [rule({ scope: 'category', categoryId: 'c1' })]);
    expect(r.quantityDiscount).toBe(20);
  });
  it('aplica por grupo (regras antigas sem escopo)', () => {
    const r = computeGroupDiscounts([item({ groupId: 'G1' })], [rule({ groupId: 'G1', discountPercent: 5 })]);
    expect(r.quantityDiscount).toBe(5);
  });
  it('aplica só ao produto específico', () => {
    const r = computeGroupDiscounts([item({ productId: 'a' }), item({ productId: 'b' })], [rule({ scope: 'product', productId: 'a' })]);
    expect(r.quantityDiscount).toBe(10);
  });
  it('produto tem prioridade sobre grupo e categoria', () => {
    const r = computeGroupDiscounts([item({ productId: 'a', groupId: 'G', categoryId: 'c' })], [
      rule({ scope: 'category', categoryId: 'c', discountPercent: 30 }),
      rule({ groupId: 'G', discountPercent: 20 }),
      rule({ scope: 'product', productId: 'a', discountPercent: 15 }),
    ]);
    expect(r.quantityDiscount).toBe(15);
  });
});
