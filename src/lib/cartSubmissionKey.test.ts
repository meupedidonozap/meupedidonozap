import { describe, it, expect } from 'vitest';
import { cartSubmissionKey } from './cartSubmissionKey';
const items = [{ productId: 'a', quantity: 2, price: 10 }, { productId: 'b', variantId: 'v', quantity: 1, price: 5 }];
describe('cartSubmissionKey', () => {
  it('mesmo carrinho reenviado gera a mesma chave (não duplica orçamento)', () => {
    expect(cartSubmissionKey('s', '98359', items)).toBe(cartSubmissionKey('s', '98359', [...items].reverse()));
  });
  it('carrinho alterado ou outro cliente gera chave nova', () => {
    expect(cartSubmissionKey('s', '98359', items)).not.toBe(cartSubmissionKey('s', '98359', [{ ...items[0], quantity: 3 }, items[1]]));
    expect(cartSubmissionKey('s', '98359', items)).not.toBe(cartSubmissionKey('s', '87965', items));
  });
});
