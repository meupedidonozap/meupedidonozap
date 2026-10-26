import { describe, it, expect } from 'vitest';
import { getReleaseIssues } from './orderReleaseCheck';

const ok = {
  customerCode: '94967', sellerCode: '345',
  customer: { paymentFormaCodigo: '1', paymentCondicaoCodigo: '30' },
  items: [{ code: 'A1', quantity: 2 }],
};

describe('getReleaseIssues', () => {
  it('pedido completo passa', () => expect(getReleaseIssues(ok)).toEqual([]));
  it('sem forma de pagamento', () =>
    expect(getReleaseIssues({ ...ok, customer: { paymentCondicaoCodigo: '30' } })).toContain('Falta forma de pagamento'));
  it('sem condição de pagamento', () =>
    expect(getReleaseIssues({ ...ok, customer: { paymentFormaCodigo: '1' } })).toContain('Falta condição de pagamento'));
  it('sem código do cliente', () =>
    expect(getReleaseIssues({ ...ok, customerCode: '' })).toContain('Cliente sem código do ERP'));
  it('sem vendedor', () =>
    expect(getReleaseIssues({ ...ok, sellerCode: '' })).toContain('Falta vendedor (código do representante)'));
  it('sem itens', () => expect(getReleaseIssues({ ...ok, items: [] })).toContain('Pedido sem itens'));
  it('item com quantidade zero', () =>
    expect(getReleaseIssues({ ...ok, items: [{ code: 'A1', quantity: 0 }] })).toContain('Há item sem código ou com quantidade zerada'));
});
