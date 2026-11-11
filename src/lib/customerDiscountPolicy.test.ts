import { describe, it, expect } from 'vitest';
import { calculateCustomerOrder, canRecalculateOrder, customerDiscountsBlocked } from './customerDiscountPolicy';
import { computeGroupDiscounts, ensureItemDiscountPercents } from './groupDiscounts';
const items = [{ productId: 'p', code: '1', name: 'Produto', price: 100, quantity: 10, groupId: 'g', discountPercent: 20 }];
const products = [{ id: 'p', priceTable1: 80 }];
const rules: any[] = [{ id: 'r', type: 'group', groupId: 'g', minQuantity: 2, discountPercent: 20, priceTable: 1 }];
describe('cliente DiColore sem desconto', () => {
  it('usa somente preço da tabela 1 mesmo atingindo faixa de desconto', () => {
    const r = calculateCustomerOrder(items, products, rules, 1, true);
    expect(r.subtotal).toBe(800); expect(r.discount).toBe(0); expect(r.items[0].price).toBe(80); expect(r.items[0].discountPercent).toBe(0);
    expect(computeGroupDiscounts(items, rules, 1, true).quantityDiscount).toBe(0);
  });
  it('cliente desmarcado volta a receber faixas', () => {
    expect(calculateCustomerOrder(items, products, rules, 1, false).discount).toBe(160);
  });
  it('não afeta outras lojas', () => {
    expect(customerDiscountsBlocked('jewosnewborn', { noDiscount: true })).toBe(false);
    expect(customerDiscountsBlocked('dicolore', { noDiscount: true })).toBe(true);
  });
  it('permite somente orçamento e pendente não transmitidos', () => {
    expect(canRecalculateOrder({ status: 'orcamento' })).toBe(true);
    expect(canRecalculateOrder({ status: 'pendente' })).toBe(true);
    expect(canRecalculateOrder({ status: 'liberado_transmissao' })).toBe(false);
    expect(canRecalculateOrder({ status: 'confirmado' })).toBe(false);
    expect(canRecalculateOrder({ status: 'pendente', erpSentAt: '2026-11-11' })).toBe(false);
    expect(canRecalculateOrder({ status: 'orcamento', xmlDownloadedAt: '2026-11-11' })).toBe(false);
  });
  it('impressão não recria descontos bloqueados', () => {
    expect(ensureItemDiscountPercents(items, rules, 1, true)[0].discountPercent).toBe(0);
  });
  it('não usa preço de outra tabela quando falta preço', () => {
    expect(() => calculateCustomerOrder(items, [{ id: 'p', priceTable1: 0, priceTable4: 100 }], rules, 1, true)).toThrow();
  });
});