import { describe, it, expect } from 'vitest';
import { televendasOrderKeys, isTelevendasInvoice } from './televendasSplit';

const orders = [
  { external_key: '1|100', pedido_televendas: true, televendas_codigo: '9' },
  { external_key: '1|101', pedido_televendas: true, televendas_codigo: '5' },
  { external_key: '1|102', pedido_televendas: false, televendas_codigo: null },
];

describe('separação televendas x carteira', () => {
  it('NF do pedido emitido pela Denise (9) conta para ela', () => {
    expect(isTelevendasInvoice({ filial_codigo: '1', pedido_codigo: '100' }, televendasOrderKeys(orders, '09'))).toBe(true);
  });
  it('NF de pedido de outra operadora ou do vendedor não conta', () => {
    const k = televendasOrderKeys(orders, '9');
    expect(isTelevendasInvoice({ filial_codigo: '1', pedido_codigo: '101' }, k)).toBe(false);
    expect(isTelevendasInvoice({ filial_codigo: '1', pedido_codigo: '102' }, k)).toBe(false);
  });
});
