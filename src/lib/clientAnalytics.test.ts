import { describe, it, expect } from 'vitest';
import { analyzeClients, abcClasses, previousRange, frequencyOf, concentration, goalProgress, groupStats } from './clientAnalytics';

const cust = (code: string, seller = '10', city = 'Campinas') => ({ code, name: 'C' + code, city, uf: 'SP', seller, active: true });
const range = { from: '2026-10-01', to: '2026-10-31' };

describe('clientAnalytics', () => {
  it('período anterior tem a mesma duração', () => {
    expect(previousRange(range)).toEqual({ from: '2026-08-31', to: '2026-09-30' });
  });
  it('frequência por intervalo médio', () => {
    expect(frequencyOf(7, 5)).toBe('Semanal');
    expect(frequencyOf(15, 5)).toBe('Quinzenal');
    expect(frequencyOf(30, 5)).toBe('Mensal');
    expect(frequencyOf(null, 1)).toBe('Compra única');
  });
  it('ABC: A até 80% acumulado', () => {
    const items = [{ v: 70 }, { v: 20 }, { v: 6 }, { v: 4 }];
    const m = abcClasses(items, i => i.v);
    expect(items.map(i => m.get(i))).toEqual(['A', 'B', 'B', 'C']);
  });
  it('intervalo médio, ticket, tendência e status', () => {
    const { rows } = analyzeClients({
      customers: [cust('001'), cust('2')], range, today: '2026-11-16',
      invoices: [
        { customer: '1', seller: '10', date: '2026-10-01', value: 100 },
        { customer: '1', seller: '10', date: '2026-10-31', value: 300 },
        { customer: '1', seller: '10', date: '2026-09-10', value: 800 },
        { customer: '2', seller: '10', date: '2026-05-01', value: 50 },
      ], mix: [],
    });
    const a = rows.find(r => r.code === '1')!;
    expect(a.orders).toBe(2); expect(a.ticket).toBe(200); expect(a.avgInterval).toBe(26);
    expect(a.trend).toBe(-50); expect(a.opportunities).toContain('Reduziu compras');
    const b = rows.find(r => r.code === '2')!;
    expect(b.status).toBe('Inativo');
  });
  it('mix: linhas não compradas entre as principais', () => {
    const { rows } = analyzeClients({
      customers: [cust('1'), cust('2')], range, today: '2026-11-01', invoices: [],
      mix: [
        { customer: '1', category: 'COLOR', value: 100, period: 'cur' },
        { customer: '2', category: 'COLOR', value: 100, period: 'cur' },
        { customer: '2', category: 'TRAT', value: 50, period: 'cur' },
      ], lineMap: { TRAT: 'TRATAMENTO' },
    });
    expect(rows.find(r => r.code === '1')!.missingLines).toEqual(['TRATAMENTO']);
  });
  it('concentração e positivação por cidade', () => {
    const { rows } = analyzeClients({
      customers: [cust('1'), cust('2'), cust('3', '10', 'Limeira')], range, today: '2026-11-01', mix: [],
      invoices: [{ customer: '1', seller: '10', date: '2026-10-05', value: 900 }, { customer: '2', seller: '10', date: '2026-10-05', value: 100 }],
    });
    expect(concentration(rows).n80).toBe(1);
    const camp = groupStats(rows, r => r.city).find(g => g.key === 'Campinas')!;
    expect(camp.positivation).toBe(100);
    expect(groupStats(rows, r => r.city).find(g => g.key === 'Limeira')!.positivation).toBe(0);
  });
  it('atingimento de meta por vendedor', () => {
    const { rows } = analyzeClients({ customers: [cust('1', '010')], range, today: '2026-11-01', mix: [], invoices: [{ customer: '1', seller: '10', date: '2026-10-05', value: 500 }] });
    const g = goalProgress(rows, { '10': { revenue: 1000, buyers: 2 } })[0];
    expect(g.revenuePct).toBe(50); expect(g.buyersPct).toBe(50);
  });
});
