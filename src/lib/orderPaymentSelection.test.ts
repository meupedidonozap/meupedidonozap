import { describe, expect, it } from 'vitest';
import { orderPaymentSelection } from './orderPaymentSelection';

describe('saved order payment selection', () => {
  it('restores the last chosen ERP form 4 and condition 71 on editing', () => {
    expect(orderPaymentSelection({ paymentFormaCodigo: '4', paymentCondicaoCodigo: '71' }))
      .toEqual({ formaCodigo: '4', condicaoCodigo: '71' });
  });
  it('keeps an unselected payment empty instead of inheriting another order', () => {
    expect(orderPaymentSelection(null)).toEqual({ formaCodigo: '', condicaoCodigo: '' });
  });
});