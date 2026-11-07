import { describe, it, expect } from 'vitest';
import { normalizeFrete } from './dwCustomerFields';

describe('frete do ERP', () => {
  it('0 é CIF e continua 0', () => { expect(normalizeFrete('0')).toBe('0'); expect(normalizeFrete('CIF')).toBe('0'); });
  it('1 é FOB e continua 1', () => { expect(normalizeFrete('1')).toBe('1'); expect(normalizeFrete('FOB')).toBe('1'); });
  it('vazio não vira CIF por padrão', () => { expect(normalizeFrete('')).toBe(''); expect(normalizeFrete(null)).toBe(''); });
});
