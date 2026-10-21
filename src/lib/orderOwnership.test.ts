import { describe, it, expect } from 'vitest';
import { isCustomerOrder, canEditOrder, claimCustomerOrder } from './orderOwnership';

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
  it('pedido do cliente não assumido: vendedor e televendas editam', () => {
    const o = { customer: { createdByRole: 'cliente', ownerRole: 'vendedor', ownerName: 'Rita' } };
    expect(canEditOrder(o, vend)).toBe(true);
    expect(canEditOrder(o, tv)).toBe(true);
  });
  it('televendas assume primeiro: vendedor fica bloqueado', () => {
    const o = { customer: claimCustomerOrder({ createdByRole: 'cliente', ownerRole: 'vendedor', ownerName: 'Rita' }, { isTelevendas: true, name: 'Grazi', erpCode: '5' }) };
    expect(o.customer.isTelevendas).toBe(true);
    expect(canEditOrder(o, { isTelevendas: true, name: 'Grazi', erpCode: '5' })).toBe(true);
    expect(canEditOrder(o, vend)).toBe(false);
    expect(canEditOrder(o, { isTelevendas: true, name: 'Denise', erpCode: '9' })).toBe(false);
  });
  it('vendedor assume primeiro: televendas fica bloqueada', () => {
    const o = { customer: claimCustomerOrder({ createdByRole: 'cliente', ownerRole: 'televendas', isTelevendas: true }, vend) };
    expect(o.customer.isTelevendas).toBeUndefined();
    expect(canEditOrder(o, vend)).toBe(true);
    expect(canEditOrder(o, tv)).toBe(false);
  });
  it('cliente escolheu televendas e ela assumiu: televendas é dona', () => {
    const o = { customer: { createdByRole: 'cliente', claimedRole: 'televendas', claimedName: 'Grazi' } };
    expect(canEditOrder(o, tv)).toBe(true);
    expect(canEditOrder(o, vend)).toBe(false);
  });
  it('cliente escolheu vendedor: vendedor é dono', () => {
    const o = { customer: { createdByRole: 'cliente', claimedRole: 'vendedor', claimedName: 'Rita' } };
    expect(canEditOrder(o, vend)).toBe(true);
    expect(canEditOrder(o, tv)).toBe(false);
  });
  it('gestor edita qualquer pedido sem tomar a posse (cadeia preservada)', () => {
    const tvOrder = { createdByRole: 'televendas', ownerRole: 'televendas', isTelevendas: true, ownerName: 'Grazi' };
    const cliOrder = { createdByRole: 'cliente', ownerRole: 'vendedor', ownerName: 'Rita' };
    const gestor = { isAdmin: true, name: 'Gestor' };
    expect(claimCustomerOrder(tvOrder, gestor)).toEqual(tvOrder);
    expect(claimCustomerOrder(cliOrder, gestor)).toEqual(cliOrder);
    expect(canEditOrder({ customer: tvOrder }, gestor)).toBe(true);
    expect(canEditOrder({ customer: cliOrder }, gestor)).toBe(true);
  });
  it('admin sempre edita', () => {
    expect(canEditOrder({ customer: { createdByRole: 'cliente' } }, { isAdmin: true })).toBe(true);
  });
});

describe('televendas nome invertido', () => {
  it('"Televendas Grazi" = "Grazi TeleVendas"', () => {
    const o = { customer: { createdByRole: 'cliente', claimedRole: 'televendas', claimedName: 'Televendas Grazi' } };
    expect(canEditOrder(o, { isTelevendas: true, name: 'Grazi TeleVendas' })).toBe(true);
    expect(canEditOrder(o, { isTelevendas: true, name: 'Denise TeleVendas' })).toBe(false);
  });
  it('código ERP decide quando presente', () => {
    const o = { customer: { ownerRole: 'televendas', ownerName: 'X', televendasErpCode: '5' } };
    expect(canEditOrder(o, { isTelevendas: true, name: 'Y', erpCode: '5' })).toBe(true);
    expect(canEditOrder(o, { isTelevendas: true, name: 'X', erpCode: '9' })).toBe(false);
  });
});
