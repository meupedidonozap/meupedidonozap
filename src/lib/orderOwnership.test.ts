import { describe, it, expect } from 'vitest';
import { isCustomerOrder, canEditOrder } from './orderOwnership';

describe('isCustomerOrder', () => {
  it('pedido criado pelo cliente é somente leitura para vendedor', () => {
    expect(isCustomerOrder({ origem: 'web', customer: { createdByRole: 'cliente' } })).toBe(true);
  });
  it('pedido do televendas pode ser editado', () => {
    expect(isCustomerOrder({ origem: 'web', customer: { createdByRole: 'televendas' } })).toBe(false);
  });
  it('pedido antigo com origem vendedor pode ser editado', () => {
    expect(isCustomerOrder({ origem: 'vendedor', customer: {} })).toBe(false);
  });
  it('pedido antigo da loja (web) sem criador é do cliente', () => {
    expect(isCustomerOrder({ origem: 'web', customer: {} })).toBe(true);
  });
});


describe('canEditOrder', () => {
  const vend = { name: 'Rita' };
  const tv = { isTelevendas: true, name: 'Grazi' };
  it('pedido do vendedor: só vendedor edita', () => {
    const o = { customer: { createdByRole: 'vendedor', createdByName: 'Rita' } };
    expect(canEditOrder(o, vend)).toBe(true);
    expect(canEditOrder(o, tv)).toBe(false);
  });
  it('pedido do televendas: só a televendas edita', () => {
    const o = { customer: { createdByRole: 'televendas', televendasName: 'Grazi' } };
    expect(canEditOrder(o, tv)).toBe(true);
    expect(canEditOrder(o, vend)).toBe(false);
  });
  it('cliente escolheu televendas: televendas é dona', () => {
    const o = { customer: { createdByRole: 'cliente', ownerRole: 'televendas', ownerName: 'Grazi' } };
    expect(canEditOrder(o, tv)).toBe(true);
    expect(canEditOrder(o, vend)).toBe(false);
  });
  it('cliente escolheu vendedor: vendedor é dono', () => {
    const o = { customer: { createdByRole: 'cliente', ownerRole: 'vendedor', ownerName: 'Rita' } };
    expect(canEditOrder(o, vend)).toBe(true);
    expect(canEditOrder(o, tv)).toBe(false);
  });
  it('admin sempre edita', () => {
    expect(canEditOrder({ customer: { createdByRole: 'cliente' } }, { isAdmin: true })).toBe(true);
  });
});

describe('televendas nome invertido', () => {
  it('"Televendas Grazi" = "Grazi TeleVendas"', () => {
    const o = { customer: { createdByRole: 'cliente', ownerRole: 'televendas', ownerName: 'Televendas Grazi' } };
    expect(canEditOrder(o, { isTelevendas: true, name: 'Grazi TeleVendas' })).toBe(true);
    expect(canEditOrder(o, { isTelevendas: true, name: 'Denise TeleVendas' })).toBe(false);
  });
  it('código ERP decide quando presente', () => {
    const o = { customer: { ownerRole: 'televendas', ownerName: 'X', televendasErpCode: '5' } };
    expect(canEditOrder(o, { isTelevendas: true, name: 'Y', erpCode: '5' })).toBe(true);
    expect(canEditOrder(o, { isTelevendas: true, name: 'X', erpCode: '9' })).toBe(false);
  });
});
