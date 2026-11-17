import { describe, expect, it } from 'vitest';
import { analyticsRows } from './analyticsRead';
describe('authorized analytics pagination', () => {
  it('retains all 4501 rows in stable order with at most four concurrent reads', async () => {
    let active = 0, max = 0;
    const source = Array.from({ length: 4501 }, (_, i) => i);
    const result = await analyticsRows(async (from, to) => {
      active++; max = Math.max(max, active);
      await new Promise(resolve => setTimeout(resolve, 1)); active--;
      return { data: source.slice(from, to + 1), error: null };
    });
    expect(result).toEqual(source); expect(max).toBe(4);
  });
  it('rejects a failed page instead of reporting incomplete coverage', async () => {
    await expect(analyticsRows(async from => ({ data: [], error: from === 1000 ? new Error('denied') : null }))).rejects.toThrow('denied');
  });
});