import { describe, it, expect } from 'vitest';
import { isCustomerOrder } from './orderOwnership';

describe('isCustomerOrder', () => {
  it('pedido criado pelo cliente é somente leitura para vendedor', () => {
    expect(isCustomerOrder({ origem: 'web', customer: { createdByRole: 'cliente' } })).toBe(true);
  });
  it('pedido do televendas pode ser editado', () => {
    expect(isCustomerOrder({ origem: 'web', customer: { createdByRole: 'televendas' } })).toBe(false);
  });
  it('pedido antigo com origem vendedor pode ser editado', () => {
    expect(isCustomerOrder({ origem: 'vendedor', customer: {} })).toBe(false);
  });
  it('pedido antigo da loja (web) sem criador é do cliente', () => {
    expect(isCustomerOrder({ origem: 'web', customer: {} })).toBe(true);
  });
});
