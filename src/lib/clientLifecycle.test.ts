import { describe, expect, it } from 'vitest';
import { lifecycleRows, type PurchaseDay } from './clientLifecycle';
const customer = { code: '001', name: 'Cliente', seller: '04', city: 'Campinas', uf: 'SP', active: true };
const run = (dates: string[], from = '2026-09-01', to = '2026-11-16') => lifecycleRows([customer], { from: '2024-11-16', to, clients: [{ code: '1', days: dates.map(date => ({ date, revenue: 100, invoices: 1 })) }] }, { from, to })[0];
describe('client lifecycle bounded history', () => {
  it('never claims lifetime absence from a partial history', () => {
    expect(run([]).stage).toBe('Sem compras no histórico disponível');
    expect(run([]).daysSince).toBeNull();
  });
  it('detects monthly purchases becoming quarterly with six months of inactivity', () => {
    const r = run(['2025-08-20', '2025-09-19', '2025-10-19', '2026-01-17', '2026-04-17']);
    expect(r.historical).toBe(30); expect(r.recent).toBe(90);
    expect(r.slowing).toBe(true); expect(r.stage).toBe('Inativo crítico');
    expect(r.daysSince).toBe(213);
  });
  it('flags slowing before loss of the customer', () => {
    const r = run(['2026-06-01', '2026-07-01', '2026-07-31', '2026-10-29']);
    expect(r.stage).toBe('Desacelerando'); expect(r.historical).toBe(30); expect(r.recent).toBe(90);
  });
  it('reactivation requires an observed gap greater than 90 days and a return within the selected period', () => {
    expect(run(['2026-05-01', '2026-10-01']).stage).toBe('Reativado');
    expect(run(['2026-05-01', '2026-10-01'], '2026-11-01').returned).toBe(false);
    expect(run(['2026-07-03', '2026-10-01']).returned).toBe(false);
  });
  it('labels first observed purchase instead of pretending it is the lifetime first', () => {
    expect(run(['2026-11-01']).stage).toBe('Primeira compra observada');
  });
  it('risk starts after 90 days and critical inactivity at 180', () => {
    expect(run(['2026-08-18']).stage).not.toBe('Em risco');
    expect(run(['2026-08-17']).stage).toBe('Em risco');
    expect(run(['2026-05-20']).stage).toBe('Inativo crítico');
  });
  it('excludes future purchases and calculates ticket per invoice, not per purchase day', () => {
    const days: PurchaseDay[] = [{ date: '2026-10-01', revenue: 600, invoices: 3 }, { date: '2026-12-01', revenue: 900, invoices: 1 }];
    const r = lifecycleRows([customer], { from: '2024-11-16', to: '2026-11-16', clients: [{ code: '1', days }] }, { from: '2026-09-01', to: '2026-11-16' })[0];
    expect(r.ticket).toBe(200); expect(r.revenue).toBe(600); expect(r.last).toBe('2026-10-01');
  });
});