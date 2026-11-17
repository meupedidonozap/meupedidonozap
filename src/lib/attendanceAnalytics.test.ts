import { describe, expect, it } from 'vitest';
import { attendanceReport, periodBounds, validSettings, type AttendanceClient, type AttendanceVisit } from './attendanceAnalytics';
const client = (id: string, code: string, seller = '32'): AttendanceClient => ({ id, customer_code: code, name: id, nome_fantasia: null, seller_code: seller, city: 'Joinville', uf: 'SC', data_ultima_compra: null });
const visit = (id: string, date: string, seller = '32', duration: number | null = 600): AttendanceVisit => ({ id: date + id, customer_profile_id: id, seller_code: seller, seller_user_id: seller, checked_in_at: date + 'T15:00:00Z', checked_out_at: duration == null ? null : date + 'T15:10:00Z', duration_seconds: duration, checkout_reason: 'Sem interesse', checkout_notes: null, distance_meters_at_checkin: 10, out_of_range_reason: null });
describe('supervisão de atendimento', () => {
  it('resumos mantêm última visita de outra carteira, faturamento e conversão', () => {
    const clients = [client('a', '001', '53'), client('b', '1', '53')];
    const visits = [visit('a', '2026-08-01', '32'), visit('b', '2026-11-02', '53')];
    const purchases = [{ cliente_codigo: '1', data_emissao: '2026-05-01', status: '100', valor_total_nota_fiscal: 900 }, { cliente_codigo: '1', data_emissao: '2026-11-03', status: '100', valor_total_nota_fiscal: 100 }];
    const full = attendanceReport(clients, visits, purchases, '2026-11-01', '2026-11-16', '53', 90);
    const compact = attendanceReport(clients, visits.slice(1), purchases.slice(1).map(p => ({ ...p, valor_total_nota_fiscal: undefined })), '2026-11-01', '2026-11-16', '53', 90, { history: [{ customer_profile_id: 'a', last: '2026-08-01' }, { customer_profile_id: 'b', last: '2026-11-02' }], revenue: [{ cliente_codigo: '1', valor_total_nota_fiscal: 1000 }] });
    expect(compact).toEqual(full);
    expect(compact.coverage[0].revenue).toBe(1000);
    expect(compact.bought).toBe(1);
  });
  it('pedido realizado por prospect conta como compra mesmo sem NF ou código ERP', () => {
    const result = attendanceReport([client('a', '')], [visit('a', '2026-11-02')], [{ cliente_codigo: '', customer_profile_id: 'a', data_emissao: '2026-11-03', status: 'pendente' }], '2026-11-01', '2026-11-16', 'all', 90);
    expect(result.bought).toBe(1); expect(result.withoutPurchase).toBe(0);
  });
  it('cadastro inativo mantém identidade da visita mas sai da carteira ativa', () => {
    const result = attendanceReport([{ ...client('a', '1'), is_active: false }], [visit('a', '2026-11-02')], [{ cliente_codigo: '1', data_emissao: '2026-11-03', status: '100' }], '2026-11-01', '2026-11-16', 'all', 90);
    expect(result.bought).toBe(1); expect(result.coverage).toHaveLength(0);
  });
  it('inclui A e B, não inclui o dia seguinte', () => {
    const result = attendanceReport([client('a', '001')], [visit('a', '2026-11-01'), visit('a', '2026-11-02'), visit('a', '2026-11-03')], [], '2026-11-01', '2026-11-02', 'all', 90);
    expect(result.rows.length).toBe(2);
  });
  it('prazo maior que 90 dias não inclui exatamente 90; identifica quem nunca teve visita', () => {
    const result = attendanceReport([client('a', '1'), client('b', '2'), client('c', '3')], [visit('a', '2026-08-18'), visit('b', '2026-08-17')], [], '2026-11-01', '2026-11-16', 'all', 90);
    expect(result.coverage.map(c => c.stale)).toEqual([false, true, true]);
  });
  it('compra depois da visita e no período; cancelamentos não contam', () => {
    const result = attendanceReport([client('a', '001'), client('b', '2')], [visit('a', '2026-11-02'), visit('b', '2026-11-02')], [{ cliente_codigo: '1', data_emissao: '2026-11-03', status: '100' }, { cliente_codigo: '2', data_emissao: '2026-11-03', status: '101' }], '2026-11-01', '2026-11-16', 'all', 90);
    expect(result.bought).toBe(1); expect(result.withoutPurchase).toBe(1);
  });
  it('visita anterior não fica perdida com transferência de carteira', () => {
    const result = attendanceReport([client('a', '1', '53')], [visit('a', '2026-11-01', '32')], [], '2026-11-01', '2026-11-16', '53', 90);
    expect(result.rows).toHaveLength(0); expect(result.coverage[0].last).toBe('2026-11-01');
  });
  it('cadastros duplicados do mesmo ERP contam como um cliente', () => {
    const result = attendanceReport([client('a', '1'), client('b', '001')], [visit('a', '2026-11-02'), visit('b', '2026-11-03')], [], '2026-11-01', '2026-11-16', 'all', 90);
    expect(result.visited).toBe(1); expect(result.coverage).toHaveLength(1);
  });
  it('tempo médio exclui atendimentos abertos', () => {
    const result = attendanceReport([client('a', '1')], [visit('a', '2026-11-02'), visit('a', '2026-11-03', '32', null)], [], '2026-11-01', '2026-11-16', 'all', 90);
    expect(result.averageSeconds).toBe(600);
  });
  it('mês anterior e 90 dias têm os limites esperados', () => {
    expect(periodBounds('previous', '2026-11-16')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(periodBounds('90', '2026-11-16')).toEqual({ from: '2026-08-19', to: '2026-11-16' });
  });
  it('metas e prazo configuráveis rejeitam números fora dos limites', () => {
    expect(validSettings({ staleDays: 90, goals: { '32': { visitsPerDay: 8, minutesPerVisit: 20 } } })).toBe(true);
    expect(validSettings({ staleDays: 0, goals: {} })).toBe(false);
    expect(validSettings({ staleDays: 90, goals: { '32': { visitsPerDay: -1, minutesPerVisit: 20 } } })).toBe(false);
  });
});