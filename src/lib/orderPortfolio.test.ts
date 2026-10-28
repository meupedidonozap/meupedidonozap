import { describe, it, expect } from 'vitest';
import { buildPortfolioMatcher } from './orderPortfolio';

const profiles = [
  { customerCode: '95067', sellerCode: '293', whatsapp: '11999990001' },
  { customerCode: '1000', sellerCode: '345', whatsapp: '11999990002' },
];
const pend = (customer: any) => ({ status: 'pendente', customer });

describe('carteira de pedidos pendentes', () => {
  it('vendedor vê só pedido de cliente da sua carteira', () => {
    const m = buildPortfolioMatcher(profiles, ['293']);
    expect(m(pend({ customerCode: '95067', sellerCode: '345' }))).toBe(true);
    expect(m(pend({ customerCode: '1000', sellerCode: '293' }))).toBe(false);
  });
  it('televendas vê clientes de todos os seus vendedores', () => {
    const m = buildPortfolioMatcher(profiles, ['293', '345']);
    expect(m(pend({ customerCode: '95067' }))).toBe(true);
    expect(m(pend({ customerCode: '1000' }))).toBe(true);
  });
  it('cliente fora do cadastro usa o vendedor do pedido', () => {
    const m = buildPortfolioMatcher(profiles, ['293']);
    expect(m(pend({ customerCode: '777', sellerCode: '293' }))).toBe(true);
    expect(m(pend({ customerCode: '777', sellerCode: '999' }))).toBe(false);
  });
});
