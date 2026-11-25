import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeOrderPriceIssues, getOrderPriceIssues, reportOrderPriceIssues, subscribeOrderPriceIssues } from './orderPriceIssues';

const issue = { items: [{ productId: 'box', code: 'DV7538.1.002', name: 'CAIXA KIT PRESENTE PARA LINHA DE REVENDA' }], table: 9 as const, description: 'Sem preço', orderNumber: 973 };
afterEach(closeOrderPriceIssues);

describe('avisos de produtos sem preço por loja', () => {
  it('mantém o aviso disponível até o usuário fechar', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeOrderPriceIssues(listener);
    expect(reportOrderPriceIssues(issue, 'dicolore')).toBe(true);
    await Promise.resolve();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getOrderPriceIssues()).toEqual(issue);
    closeOrderPriceIssues();
    expect(getOrderPriceIssues()).toBeNull();
    unsubscribe();
  });
  it.each(['jewosnewborn', 'dicoloresenses', 'limpa-telhas-brusque'])('preserva o aviso legado de %s', slug => {
    expect(reportOrderPriceIssues(issue, slug)).toBe(false);
    expect(getOrderPriceIssues()).toBeNull();
  });
  it('não exibe um aviso sem itens', () => {
    expect(reportOrderPriceIssues({ ...issue, items: [] }, 'dicolore')).toBe(false);
    expect(getOrderPriceIssues()).toBeNull();
  });
});