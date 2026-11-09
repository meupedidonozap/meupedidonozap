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
  it('prospect sem CPF/CNPJ bloqueia', () =>
    expect(getReleaseIssues({ ...ok, customerCode: '' })).toContain('Cliente PROSPECT sem CPF/CNPJ'));
  it('prospect com CNPJ pode ser liberado', () =>
    expect(getReleaseIssues({ ...ok, customerCode: '', customer: { ...ok.customer, cpfCnpj: '12.345.678/0001-90' } })).toEqual([]));
  it('sem vendedor', () =>
    expect(getReleaseIssues({ ...ok, sellerCode: '' })).toContain('Falta vendedor (código do representante)'));
  it('sem itens', () => expect(getReleaseIssues({ ...ok, items: [] })).toContain('Pedido sem itens'));
  it('item com quantidade zero', () =>
    expect(getReleaseIssues({ ...ok, items: [{ code: 'A1', quantity: 0 }] })).toContain('Há item sem código ou com quantidade zerada'));
});
