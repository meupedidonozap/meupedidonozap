import { describe, expect, it } from 'vitest';
import { getAvailablePaymentMethods } from './paymentAvailability';

describe('getAvailablePaymentMethods', () => {
  it('não oferece cartão quando o admin o desativa, mesmo com a flag antiga ativa', () => {
    const methods = getAvailablePaymentMethods({
      acceptCard: true,
      acceptPix: true,
      paymentGateway: { cardEnabled: false, pixEnabled: true },
    });

    expect(methods).toEqual(['pix', 'dinheiro']);
  });

  it('oferece cartão quando o admin o ativa, mesmo com a flag antiga desativada', () => {
    expect(getAvailablePaymentMethods({
      acceptCard: false,
      paymentGateway: { cardEnabled: true },
    })).toContain('cartao');
  });

  it('mantém a configuração antiga em lojas sem o cartão de recebimento configurado', () => {
    expect(getAvailablePaymentMethods({ acceptCard: true, acceptPix: false }))
      .toEqual(['cartao', 'dinheiro']);
  });
});
