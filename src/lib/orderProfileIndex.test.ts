import { describe, expect, it } from 'vitest';
import { buildOrderProfileIndex } from './orderProfileIndex';

const official = { id: 'official', customerCode: '86553', cpfCnpj: '12345678901', userId: 'login', sellerCode: '45', transportadora: '175' };
const duplicate = { ...official, id: 'duplicate', customerCode: '', sellerCode: '', transportadora: '' };

describe('indexed order customer identity', () => {
  it('keeps the explicit ERP registration instead of the duplicate login', () => {
    expect(buildOrderProfileIndex([duplicate, official])({ customer: { customerCode: '86553' }, userId: 'login' })).toBe(official);
  });
  it('never substitutes another registration for an unknown explicit code', () => {
    expect(buildOrderProfileIndex([official])({ customer: { customerCode: '999', cpfCnpj: official.cpfCnpj }, userId: 'login' })).toBeUndefined();
  });
  it('recovers an unambiguous registration using normalized CPF', () => {
    expect(buildOrderProfileIndex([duplicate, official])({ customer: { cpfCnpj: '123.456.789-01' } })).toBe(official);
  });
  it('does not fall back to a login when the document has multiple codes', () => {
    const other = { ...official, id: 'other', customerCode: '95032', userId: 'other-login' };
    expect(buildOrderProfileIndex([official, other])({ customer: { cpfCnpj: official.cpfCnpj }, userId: 'login' })).toBeUndefined();
  });
  it('resolves legacy orders using an unambiguous login', () => {
    expect(buildOrderProfileIndex([duplicate, official])({ customer: {}, userId: 'login' })).toBe(official);
  });
});