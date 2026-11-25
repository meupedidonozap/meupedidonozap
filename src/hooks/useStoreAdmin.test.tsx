import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const mock = vi.hoisted(() => ({ user: 'user-a', loading: false, from: vi.fn(), staff: null as null | Record<string, unknown>, admin: false, platform: false, failure: false, delay: null as null | Promise<void> }));
vi.mock('./useAuth', () => ({ useAuth: () => ({ user: mock.user ? { id: mock.user } : null, loading: mock.loading }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mock.from } }));
import { loadStoreAccess, useStoreAdmin } from './useStoreAdmin';
import { useSellerMode } from './useSellerMode';

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return { client, Wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> };
}

beforeEach(() => {
  mock.user = 'user-a'; mock.loading = false; mock.staff = null; mock.admin = false; mock.platform = false; mock.failure = false; mock.delay = null;
  mock.from.mockReset().mockImplementation((table: string) => {
    const q = {
      select: vi.fn(() => q), eq: vi.fn(() => q), order: vi.fn(() => q), limit: vi.fn(() => q), maybeSingle: vi.fn(() => q),
      then: (resolve: (value: unknown) => unknown) => (async () => {
        if (mock.delay) await mock.delay;
        if (table === 'store_users' && mock.failure) return { data: null, error: new Error('network failure') };
        return { data: table === 'store_users' ? mock.staff ? [mock.staff] : [] : table === 'store_admins' ? mock.admin ? { id: 'admin' } : null : mock.platform ? { user_id: mock.user } : null, error: null };
      })().then(resolve),
    };
    return q;
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Shared authorized store identity', () => {
  it('a customer cannot sell or gain staff/admin access', async () => {
    const { Wrapper } = wrapper();
    const hook = renderHook(() => useSellerMode('dicolore-id'), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.isStaff).toBe(false);
    expect(hook.result.current.canSell).toBe(false);
    expect(hook.result.current.canAdmin).toBe(false);
  });
  it.each(['vendedor', 'televendas', 'gerente'])('recognizes %s using the same access query as the admin entry', async role => {
    mock.staff = { role, name: 'Equipe teste', seller_codes: role === 'gerente' ? [] : ['28', '45'], erp_code: '314', can_view_orders: true };
    const { Wrapper } = wrapper();
    const hook = renderHook(() => ({ access: useStoreAdmin('dicolore-id'), seller: useSellerMode('dicolore-id') }), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.seller.loading).toBe(false));
    expect(hook.result.current.access.role).toBe(role);
    expect(hook.result.current.seller.isStaff).toBe(true);
    expect(hook.result.current.seller.canSell).toBe(true);
    expect(hook.result.current.seller.isTelevendas).toBe(role === 'televendas');
    expect(hook.result.current.seller.sellerCodes).toEqual(role === 'gerente' ? [] : ['28', '45']);
    expect(mock.from.mock.calls.filter(([table]) => table === 'store_users')).toHaveLength(1);
  });
  it.each(['store', 'platform'])('%s admins retain their existing authorized access', async type => {
    mock.admin = type === 'store'; mock.platform = type === 'platform';
    const access = await loadStoreAccess('dicolore-id', 'user-a');
    expect(access.isAdmin).toBe(true);
    expect(access.permissions.can_manage_orders).toBe(true);
    expect(access.sellerCodes).toEqual([]);
  });
  it('does not create selling permission for staff without linked codes', async () => {
    mock.staff = { role: 'vendedor', seller_codes: [], can_view_orders: true };
    const { Wrapper } = wrapper();
    const hook = renderHook(() => useSellerMode('dicolore-id'), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.isStaff).toBe(true);
    expect(hook.result.current.canSell).toBe(false);
  });
  it('propagates failure instead of storing a successful customer identity', async () => {
    mock.failure = true;
    await expect(loadStoreAccess('dicolore-id', 'user-a')).rejects.toThrow('network failure');
  });
  it('does not let an old seller identity survive an account switch', async () => {
    mock.staff = { role: 'vendedor', seller_codes: ['28'] };
    const { Wrapper } = wrapper();
    const hook = renderHook(() => useSellerMode('dicolore-id'), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.isSeller).toBe(true));
    mock.user = 'user-b'; mock.staff = null;
    hook.rerender();
    expect(hook.result.current.isSeller).toBe(false);
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.isStaff).toBe(false);
  });
  it('keeps the known role during a background refresh and marks first access as loading', async () => {
    let finish: (() => void) | undefined;
    mock.delay = new Promise<void>(resolve => { finish = resolve; });
    mock.staff = { role: 'vendedor', seller_codes: ['28'] };
    const { Wrapper, client } = wrapper();
    const hook = renderHook(() => useSellerMode('dicolore-id'), { wrapper: Wrapper });
    expect(hook.result.current.loading).toBe(true);
    await act(async () => { finish?.(); });
    await waitFor(() => expect(hook.result.current.isSeller).toBe(true));
    mock.delay = new Promise<void>(resolve => { finish = resolve; });
    act(() => { void client.invalidateQueries({ queryKey: ['store-access'] }); });
    expect(hook.result.current.isSeller).toBe(true);
    expect(hook.result.current.loading).toBe(false);
    await act(async () => { finish?.(); });
  });
});