import { describe, it, expect } from 'vitest';
import { comparePeriods } from './periodCompare';

const now = new Date(2026, 9, 14, 12); // 14/10/2026

describe('comparePeriods', () => {
  it('compara 01/10–14/10 com 01/09–14/09', () => {
    const r = comparePeriods([
      { date: '2026-09-05', value: 100 },
      { date: '2026-09-14', value: 100 },
      { date: '2026-09-20', value: 500 }, // fora do mesmo período
      { date: '2026-10-03', value: 50 },
      { date: '2026-10-20', value: 999 }, // futuro, ignorado
    ], now);
    expect(r.previousSameDays).toEqual({ count: 2, total: 200 });
    expect(r.previous).toEqual({ count: 3, total: 700 });
    expect(r.current).toEqual({ count: 1, total: 50 });
    expect(r.changeTotal).toBe(-75);
  });

  it('20 visitas antes x 7 agora sinaliza queda de 65%', () => {
    const rows = [
      ...Array.from({ length: 20 }, () => ({ date: '2026-09-10', value: 1 })),
      ...Array.from({ length: 7 }, () => ({ date: '2026-10-10', value: 1 })),
    ];
    expect(comparePeriods(rows, now).changeCount).toBe(-65);
  });

  it('janeiro compara com dezembro do ano anterior', () => {
    const r = comparePeriods([{ date: '2025-12-02', value: 10 }], new Date(2026, 0, 5));
    expect(r.previousSameDays.total).toBe(10);
  });
});
