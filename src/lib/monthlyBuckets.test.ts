import { describe, it, expect } from 'vitest';
import { monthlyBuckets } from './periodCompare';
describe('monthlyBuckets', () => {
  it('groups last 3 months oldest first', () => {
    const r = monthlyBuckets([{ date: '2026-09-10', value: 100 }, { date: '2026-11-01', value: 50 }, { date: '2026-08-31', value: 9 }], 3, new Date(2026, 10, 1, 12));
    expect(r.map(b => b.key)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(r[0].total).toBe(100); expect(r[2].count).toBe(1);
  });
});
