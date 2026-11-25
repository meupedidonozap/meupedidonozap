import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ callback: null as null | ((event: string, session: unknown) => void), resolve: null as null | ((value: unknown) => void), unsubscribe: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {
  onAuthStateChange: (callback: typeof mock.callback) => { mock.callback = callback; return { data: { subscription: { unsubscribe: mock.unsubscribe } } }; },
  getUser: () => new Promise(resolve => { mock.resolve = resolve; }),
} } }));
import { useAuth } from './useAuth';
beforeEach(() => { mock.callback = null; mock.resolve = null; vi.clearAllMocks(); });
afterEach(cleanup);

describe('Session changes cannot be undone by a delayed initial read', () => {
  it('keeps the newly signed-in account when the old getUser result arrives late', async () => {
    const hook = renderHook(useAuth);
    act(() => mock.callback?.('SIGNED_IN', { user: { id: 'vendedor' } }));
    await act(async () => mock.resolve?.({ data: { user: null } }));
    expect(hook.result.current.user?.id).toBe('vendedor');
    expect(hook.result.current.loading).toBe(false);
  });
  it('does not restore a seller after sign-out', async () => {
    const hook = renderHook(useAuth);
    act(() => mock.callback?.('SIGNED_OUT', null));
    await act(async () => mock.resolve?.({ data: { user: { id: 'vendedor-antigo' } } }));
    expect(hook.result.current.user).toBeNull();
  });
  it('uses the initial verified account when there was no newer session event', async () => {
    const hook = renderHook(useAuth);
    await act(async () => mock.resolve?.({ data: { user: { id: 'cliente' } } }));
    await waitFor(() => expect(hook.result.current.user?.id).toBe('cliente'));
  });
});