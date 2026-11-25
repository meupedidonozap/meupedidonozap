import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ loading: true, error: null as Error | null, canSell: false, selected: null as null | { id: string; storeId: string; priceTable: number }, fresh: { id: 'customer-selected', storeId: 'dicolore-id', priceTable: 9 } }));
vi.mock('./useAuth', () => ({ useAuth: () => ({ user: { id: 'staff' } }) }));
vi.mock('./useCustomerProfile', () => ({ useCustomerProfile: () => ({ data: { id: 'own-profile', priceTable: 4 }, isLoading: false }), mapProfile: (value: unknown) => value }));
vi.mock('./useSellerMode', () => ({ useSellerMode: () => ({ loading: mock.loading, accessError: mock.error, canSell: mock.canSell }) }));
vi.mock('@/contexts/SellerContext', () => ({ useSellerContext: () => ({ selectedCustomer: mock.selected, selectCustomer: vi.fn(), clearSelectedCustomer: vi.fn() }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => { const q = { select: () => q, eq: () => q, single: async () => ({ data: mock.fresh, error: null }) }; return q; } } }));
import { useActiveCustomerProfile } from './useActiveCustomerProfile';

function wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>; }
beforeEach(() => { mock.loading = true; mock.error = null; mock.canSell = false; mock.selected = null; });
afterEach(cleanup);
describe('DiColore profile cannot be stamped from an unresolved role', () => {
  it('does not offer a staff own-customer profile while access is loading or failed', () => {
    const hook = renderHook(() => useActiveCustomerProfile('dicolore-id', 'dicolore'), { wrapper });
    expect(hook.result.current.profile).toBeNull();
    mock.loading = false; mock.error = new Error('network'); hook.rerender();
    expect(hook.result.current.profile).toBeNull();
  });
  it('uses the selected customer and their table after confirming seller access', async () => {
    mock.selected = { id: 'customer-selected', storeId: 'dicolore-id', priceTable: 9 };
    const hook = renderHook(() => useActiveCustomerProfile('dicolore-id', 'dicolore'), { wrapper });
    expect(hook.result.current.profile).toBeNull();
    act(() => { mock.loading = false; mock.canSell = true; hook.rerender(); });
    await waitFor(() => expect(hook.result.current.profile?.id).toBe('customer-selected'));
    expect(hook.result.current.profile?.priceTable).toBe(9);
  });
  it('preserves other stores legacy profile resolution', () => {
    const hook = renderHook(() => useActiveCustomerProfile('other-store', 'senses'), { wrapper });
    expect(hook.result.current.profile?.id).toBe('own-profile');
  });
});