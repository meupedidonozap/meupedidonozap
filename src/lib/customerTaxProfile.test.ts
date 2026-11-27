import { describe, it, expect } from 'vitest';
import { customerTaxProfile } from './customerTaxProfile';

describe('customerTaxProfile', () => {
  it('destaca pessoa jurídica com inscrição estadual', () => {
    expect(customerTaxProfile({ cpfCnpj: '27.343.982/0001-70', ie: '258278501' })).toMatchObject({ person: 'PJ', hasIe: true, highlight: true });
  });
  it('não destaca pessoa jurídica isenta ou sem inscrição', () => {
    expect(customerTaxProfile({ cpfCnpj: '27343982000170', ie: 'ISENTO' }).highlight).toBe(false);
    expect(customerTaxProfile({ cpfCnpj: '27343982000170', ie: '' }).highlight).toBe(false);
    expect(customerTaxProfile({ cpfCnpj: '27343982000170', ie: '0' }).highlight).toBe(false);
  });
  it('não destaca pessoa física, mesmo com inscrição', () => {
    expect(customerTaxProfile({ cpfCnpj: '030.657.209-57', ie: '123456' })).toMatchObject({ person: 'PF', highlight: false });
  });
  it('usa o tipo de pessoa do ERP quando não há documento', () => {
    expect(customerTaxProfile({ cpfCnpj: '', ie: '258278501', fisicaJuridica: 'J' }).highlight).toBe(true);
  });
});
