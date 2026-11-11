import { describe, expect, it } from 'vitest';
import { getStoreRules, releasePaymentRequired } from './storeRules';
import { getReleaseIssues } from './orderReleaseCheck';

describe('regras por loja', () => {
  it('DiColore exige forma e condição por padrão', () => {
    expect(getStoreRules('dicolore', {}).requireReleasePayment).toBe(true);
    expect(getReleaseIssues({ customer: { customerCode: '90622', sellerCode: '46' }, items: [{ code: '1', quantity: 1 }] })).toEqual(['Falta forma de pagamento', 'Falta condição de pagamento']);
  });
  it('desativar na DiColore não desativa em outra loja', () => {
    const settings = { rules: { requireReleasePayment: false } };
    expect(releasePaymentRequired('dicolore', settings)).toBe(false);
    expect(releasePaymentRequired('jewos', settings)).toBe(true);
  });
  it('regra desativada dispensa apenas pagamento', () => {
    expect(getReleaseIssues({ requirePayment: false, customer: { customerCode: '90622', sellerCode: '46' }, items: [{ code: '1', quantity: 1 }] })).toEqual([]);
    expect(getReleaseIssues({ requirePayment: false, customer: { customerCode: '90622' }, items: [] })).toEqual(['Falta vendedor (código do representante)', 'Pedido sem itens']);
  });
  it('aviso WhatsApp pode ser desativado somente na configuração lida', () => {
    expect(getStoreRules('dicolore', { rules: { notifyReleaseWhatsapp: false } }).notifyReleaseWhatsapp).toBe(false);
    expect(getStoreRules('jewos', {}).notifyReleaseWhatsapp).toBe(true);
  });
});