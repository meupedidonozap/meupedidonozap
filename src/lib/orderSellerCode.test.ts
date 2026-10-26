import { describe, it, expect } from 'vitest';
import { resolveOrderSellerCode } from './orderSellerCode';

const lookups = {
  storeUsers: [{ name: 'Repres Daniel Schmitz', seller_codes: ['345'] }],
  sellers: [{ name: 'Daniel Schmitz', code: '345' }, { name: 'Jorge Augusto', code: '344' }],
};

describe('resolveOrderSellerCode', () => {
  it('cadastro do cliente vence', () => {
    expect(resolveOrderSellerCode('111', { sellerCode: '344' }, lookups).code).toBe('111');
  });
  it('usa o código gravado no pedido', () => {
    expect(resolveOrderSellerCode('', { sellerCode: '344' }, lookups).code).toBe('344');
  });
  it('pedido 560: usa o representante que criou', () => {
    const r = resolveOrderSellerCode(null, { createdByName: 'Repres Daniel Schmitz', createdByRole: 'vendedor' }, lookups);
    expect(r).toEqual({ code: '345', name: 'Daniel Schmitz' });
  });
  it('usa o vendedor escolhido pelo nome', () => {
    expect(resolveOrderSellerCode('', { sellerName: 'Jorge Augusto' }, lookups).code).toBe('344');
  });
  it('sem nada fica vazio', () => {
    expect(resolveOrderSellerCode('', { createdByName: 'Cliente X', createdByRole: 'cliente' }, lookups).code).toBe('');
  });
});
