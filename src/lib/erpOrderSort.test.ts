import { describe, expect, it } from 'vitest';
import { sortErpOrders } from './erpOrderSort';

const nums = (list: any[]) => sortErpOrders(list).map((o) => o.codigo_importacao || o.codigo);

describe('ordem dos pedidos em Vendas > Pedidos', () => {
  it('emissão mais recente primeiro', () => {
    expect(nums([
      { codigo: '723700', data_emissao: '2026-11-25' },
      { codigo: '723591', data_emissao: '2026-11-26' },
    ])).toEqual(['723591', '723700']);
  });

  it('no mesmo dia, o maior número de pedido ERP fica no topo', () => {
    expect(nums([
      { codigo: '723591', data_emissao: '2026-11-26' },
      { codigo: '99173', data_emissao: '2026-11-26' },
      { codigo: '723594', data_emissao: '2026-11-26' },
      { codigo: '723624', data_emissao: '2026-11-26' },
    ])).toEqual(['723624', '723594', '723591', '99173']);
  });

  it('compara como número, não como texto, e usa o número mostrado na tela', () => {
    expect(nums([
      { codigo: '997', codigo_importacao: '99175', data_emissao: '2026-11-26T10:00:00' },
      { codigo: '100000', data_emissao: '2026-11-26' },
    ])).toEqual(['100000', '99175']);
  });
});
