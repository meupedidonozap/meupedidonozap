import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mock.read }) }) }),
} }));
import { ensureLatestDataVersion } from './useDataVersionSync';

beforeEach(() => {
  localStorage.clear();
  mock.read.mockResolvedValue({ data: { settings: { dataVersion: 'current' } }, error: null });
});

describe('checkout data version', () => {
  it('does not interrupt a first DiColore submission without a locally stored version', async () => {
    expect(await ensureLatestDataVersion('dicolore', 'store')).toBe(false);
    expect(localStorage.getItem('dv_dicolore')).toBe('current');
  });
  it('still stops submission when a known DiColore catalog version changed', async () => {
    localStorage.setItem('dv_dicolore', 'old');
    expect(await ensureLatestDataVersion('dicolore', 'store')).toBe(true);
    expect(localStorage.getItem('dv_dicolore')).toBe('current');
    expect(await ensureLatestDataVersion('dicolore', 'store')).toBe(false);
  });
  it('preserves the legacy version gate for JEWOS', async () => {
    expect(await ensureLatestDataVersion('jewosnewborn', 'store')).toBe(true);
  });
});