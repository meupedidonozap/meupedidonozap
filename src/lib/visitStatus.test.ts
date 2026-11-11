import { describe, it, expect } from 'vitest';
import { isUnattendedCustomer } from './visitStatus';

describe('isUnattendedCustomer', () => {
  it('mantém o cliente com check-in aberto na lista de não atendidos', () => {
    expect(isUnattendedCustomer('a', new Set(['a']), new Set(['a']))).toBe(true);
  });
  it('remove o cliente após o checkout', () => {
    expect(isUnattendedCustomer('a', new Set(['a']), new Set())).toBe(false);
  });
  it('cliente sem visita segue não atendido', () => {
    expect(isUnattendedCustomer('b', new Set(['a']), new Set())).toBe(true);
  });
});
