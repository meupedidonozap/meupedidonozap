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

import { mergeEditedCustomer, isUnclaimedCustomerOrder } from './orderOwnership';
describe('dono do pedido do cliente (DiColore)', () => {
  const ronaldo = { name: 'Ronaldo' };
  const denise = { isTelevendas: true, name: 'Denise', erpCode: '7' };
  const pedido = { origem: 'web', userId: 'u', customer: { name: 'ELIANE', createdByRole: 'cliente', ownerRole: 'vendedor', ownerName: 'Ronaldo' } };
  it('livre até alguém salvar: vendedor e televendas podem editar', () => {
    expect(canEditOrder(pedido, ronaldo)).toBe(true);
    expect(canEditOrder(pedido, denise)).toBe(true);
  });
  it('quem salva primeiro vira dono e o outro fica bloqueado', () => {
    const c = mergeEditedCustomer(pedido, { name: 'ELIANE', createdByRole: 'televendas' }, denise);
    expect(c.claimedRole).toBe('televendas');
    expect(c.claimedName).toBe('Denise');
    expect(canEditOrder({ customer: c }, ronaldo)).toBe(false);
    expect(canEditOrder({ customer: c }, denise)).toBe(true);
    expect(canEditOrder({ customer: c }, { isAdmin: true })).toBe(true);
  });
  it('"Feito pelo cliente" continua depois da edição', () => {
    const c = mergeEditedCustomer(pedido, { name: 'ELIANE', createdByRole: 'vendedor', createdByName: 'Ronaldo' }, ronaldo);
    expect(c.createdByRole).toBe('cliente');
  });
  it('segunda edição não troca o dono', () => {
    const c1 = mergeEditedCustomer(pedido, { name: 'E' }, denise);
    const c2 = mergeEditedCustomer({ ...pedido, customer: c1 }, { name: 'E' }, { isAdmin: true, name: 'Admin' });
    expect(c2.claimedName).toBe('Denise');
  });
  it('#749: pedido web de conta de cliente sem marca conta como do cliente sem dono', () => {
    const o749 = { origem: 'web', userId: 'f32f', customer: { name: 'ELIANE' } };
    expect(isUnclaimedCustomerOrder(o749)).toBe(true);
    expect(canEditOrder(o749, ronaldo)).toBe(true);
    expect(mergeEditedCustomer(o749, { name: 'ELIANE' }, ronaldo).claimedName).toBe('Ronaldo');
  });
});
