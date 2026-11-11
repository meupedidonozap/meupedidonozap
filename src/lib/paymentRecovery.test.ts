import { describe, it, expect } from 'vitest';
import { recoveryCart } from './paymentRecovery';
import { paymentRefusalReason } from '../../supabase/functions/mercadopago/paymentReasons';
import { customerDataIsReadOnly } from './customerDataAccess';

describe('recuperação após recusa', () => {
  const order = { storeId: 'jewos', items: [{ productId: 'produto', quantity: 2, price: 30 }], subtotal: 60, discount: 0, total: 70 };
  it('devolve os itens exatos do pedido sem backup', () => {
    expect(recoveryCart(order).items).toEqual([{ productId: 'produto', quantity: 2, price: 30 }]);
  });
  it('não cobra o frete antigo no carrinho recuperado', () => {
    expect(recoveryCart(order).total).toBe(60);
  });
  it('não restaura carrinho de outra loja', () => {
    expect(recoveryCart(order, JSON.stringify({ storeId: 'dicolore', items: [{ quantity: 8 }] })).items).toEqual(order.items);
  });
  it('preserva backup válido da mesma loja', () => {
    const backup = { storeId: 'jewos', items: order.items, couponDiscount: 5 };
    expect(recoveryCart(order, JSON.stringify(backup))).toEqual(backup);
  });
  it('não classifica risco genérico como divergência confirmada de CPF', () => {
    expect(paymentRefusalReason('cc_rejected_high_risk').includes('não confirmou')).toBe(true);
  });
  it('identifica limite insuficiente sem supor problema de CPF', () => {
    expect(paymentRefusalReason('cc_rejected_insufficient_amount').includes('CPF')).toBe(false);
  });
  it.each(['jewosnewborn', 'mabelle', 'pizzaria', 'loja'])('permite edição do cadastro em %s', slug => {
    expect(customerDataIsReadOnly(slug, false)).toBe(false);
  });
});