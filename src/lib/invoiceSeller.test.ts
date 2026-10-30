import { describe, expect, it } from 'vitest';
import { matchesInvoiceSeller } from './invoiceSeller';

describe('invoice representative access', () => {
  it('NF 209174 belongs to representative 286, not customer representative 04', () => {
    expect(matchesInvoiceSeller('286', ['04'])).toBe(false);
    expect(matchesInvoiceSeller('286', ['286'])).toBe(true);
  });
  it('telesales sees notes of all linked representatives only', () => {
    expect(matchesInvoiceSeller('286', ['04', '286'])).toBe(true);
    expect(matchesInvoiceSeller('4', ['04', '286'])).toBe(true);
    expect(matchesInvoiceSeller('293', ['04', '286'])).toBe(false);
  });
  it('admin has no representative restriction', () => {
    expect(matchesInvoiceSeller('286', undefined)).toBe(true);
    expect(matchesInvoiceSeller('4', undefined)).toBe(true);
  });
  it('seller with no linked codes sees no notes', () => {
    expect(matchesInvoiceSeller('286', [])).toBe(false);
    expect(matchesInvoiceSeller('', [''])).toBe(false);
  });
});