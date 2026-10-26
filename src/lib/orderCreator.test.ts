import { describe, it, expect } from 'vitest';
import { getOrderCreator } from './orderCreator';

describe('getOrderCreator', () => {
  it('cliente só quando gravado como cliente', () => {
    expect(getOrderCreator({ origem: 'web', customer: { createdByRole: 'cliente', customerCode: '93401' } })).toMatchObject({ role: 'cliente', login: '93401' });
  });
  it('televendas', () => {
    expect(getOrderCreator({ customer: { createdByRole: 'televendas', createdByName: 'Denise', createdByUserEmail: 'denise@x' } }).role).toBe('televendas');
  });
  it('vendedor pela origem antiga', () => {
    expect(getOrderCreator({ origem: 'vendedor', customer: {} }).role).toBe('vendedor');
  });
  it('sem marcação não concorre como cliente', () => {
    expect(getOrderCreator({ origem: 'web', customer: {} }).role).toBe('admin');
  });
});
