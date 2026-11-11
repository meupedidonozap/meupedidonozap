import { describe, expect, it } from 'vitest';
import { canShowPaymentReceipts, getAvailablePaymentMethods } from './paymentAvailability';

describe('recebimentos DiColore', () => {
  it('oculta registro sem recebimentos habilitados, mesmo com PIX legado', () => {
    expect(canShowPaymentReceipts('dicolore', { acceptPix: true })).toBe(false);
    expect(canShowPaymentReceipts('dicolore', { paymentGateway: { pixEnabled: false, cardEnabled: false } })).toBe(false);
  });
  it('exibe registro quando PIX ou cartão são habilitados', () => {
    expect(canShowPaymentReceipts('dicolore', { paymentGateway: { pixEnabled: true } })).toBe(true);
    expect(canShowPaymentReceipts('dicolore', { paymentGateway: { cardEnabled: true } })).toBe(true);
  });
  it('preserva o registro nas outras lojas', () => {
    expect(canShowPaymentReceipts('jewosnewborn')).toBe(true);
    expect(canShowPaymentReceipts('senses')).toBe(true);
  });
});

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
