import { describe, expect, it } from 'vitest';
import { sortErpOrders, sortOrdersByStatus } from './erpOrderSort';

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

describe('ordem por status em Vendas > Pedidos', () => {
  const shown = (list: any[]) => sortOrdersByStatus(list).map((o) => o._erp || o.codigo_importacao || o.codigo);

  it('não transmitido, depois sem OF/NF, depois com OF, depois com NF', () => {
    expect(shown([
      { codigo: '723594', status: 'F', data_emissao: '2026-11-26' },
      { codigo: '723625', status: 'S', data_emissao: '2026-11-26' },
      { codigo: '723700', status: 'N', data_emissao: '2026-11-20' },
      { codigo: '1036', status: 'L', data_emissao: '2026-11-10' },
    ])).toEqual(['1036', '723700', '723625', '723594']);
  });

  it('dentro do mesmo status, emissão mais recente e maior número ERP primeiro', () => {
    expect(shown([
      { codigo: '788', _erp: '723087', status: 'N', data_emissao: '2026-11-11' },
      { codigo: '1033', _erp: '723624', status: 'N', data_emissao: '2026-11-26' },
      { codigo: '723625', status: 'N', data_emissao: '2026-11-26' },
    ])).toEqual(['723625', '723624', '723087']);
  });

  it('pedido transmitido pelo app usa o número ERP, não o número interno', () => {
    expect(shown([
      { codigo: '99999999', _erp: '723600', status: 'S', data_emissao: '2026-11-26' },
      { codigo: '723601', status: 'S', data_emissao: '2026-11-26' },
    ])).toEqual(['723601', '723600']);
  });

  it('cancelados ficam por último', () => {
    expect(shown([
      { codigo: '723900', status: 'C', data_emissao: '2026-11-27' },
      { codigo: '723100', status: 'F', data_emissao: '2026-11-01' },
    ])).toEqual(['723100', '723900']);
  });
});
