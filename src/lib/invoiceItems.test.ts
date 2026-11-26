import { describe, expect, it } from 'vitest';
import { resolveInvoiceItems } from './invoiceItems';

const nf = [{ id: 'a', produto_codigo: '789', quantidade: 4, valor_unitario: 43.7, valor_total: 174.8 }];
const order = [
  { id: 'o1', produto_codigo: '111', produto_descricao: 'SHAMPOO', quantidade_faturada: 2, valor_unitario: 10 },
  { id: 'o2', produto_codigo: '222', produto_descricao: 'NAO FATURADO', quantidade_faturada: 0, valor_unitario: 5 },
];

describe('resolveInvoiceItems', () => {
  it('usa os itens reais da nota fiscal quando existem, ignorando os do pedido', () => {
    expect(resolveInvoiceItems(nf, order, { '789': 'LA VIE' })).toEqual([
      { key: 'a', code: '789', name: 'LA VIE', quantity: 4, unit: 43.7, total: 174.8 },
    ]);
  });

  it('usa apenas os itens faturados do pedido quando a nota ainda não tem itens', () => {
    expect(resolveInvoiceItems([], order)).toEqual([
      { key: 'o1', code: '111', name: 'SHAMPOO', quantity: 2, unit: 10, total: 20 },
    ]);
  });

  it('retorna vazio quando nenhuma das fontes tem itens', () => {
    expect(resolveInvoiceItems([], [])).toEqual([]);
  });
});
