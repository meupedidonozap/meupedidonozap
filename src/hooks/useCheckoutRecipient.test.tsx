import { act, renderHook, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCheckoutRecipient } from './useCheckoutRecipient';
import type { OrderRecipient } from './useOrderRecipients';

const options: OrderRecipient[] = [
  { id: 'rita', name: 'Rita', whatsapp: '5548000000000', kind: 'vendedor' },
  { id: 'grazi', name: 'Televendas Grazi', whatsapp: '5547000000000', kind: 'televendas' },
];
const key = 'mpz_checkout_recipient:store:user:98596';
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('DiColore checkout recipient', () => {
  it('restores Grazi for customer 98596 after leaving and reopening checkout', async () => {
    const first = renderHook(() => useCheckoutRecipient('dicolore', 'store', 'user', '98596', options, true, true));
    await waitFor(() => expect(first.result.current[0]).toBe('rita'));
    act(() => first.result.current[1]('grazi'));
    expect(localStorage.getItem(key)).toBe('grazi');
    first.unmount();
    const reopened = renderHook(() => useCheckoutRecipient('dicolore', 'store', 'user', '98596', options, true, true));
    await waitFor(() => expect(reopened.result.current[0]).toBe('grazi'));
  });

  it('cannot carry a saved recipient into another account, customer or store', async () => {
    localStorage.setItem(key, 'grazi');
    const hook = renderHook(({ user, customer, store }) => useCheckoutRecipient('dicolore', store, user, customer, options, true, true), {
      initialProps: { user: 'user', customer: '98596', store: 'store' },
    });
    await waitFor(() => expect(hook.result.current[0]).toBe('grazi'));
    hook.rerender({ user: 'other', customer: '98596', store: 'store' });
    await waitFor(() => expect(hook.result.current[0]).toBe('rita'));
    hook.rerender({ user: 'user', customer: 'other', store: 'store' });
    await waitFor(() => expect(hook.result.current[0]).toBe('rita'));
    hook.rerender({ user: 'user', customer: '98596', store: 'other' });
    await waitFor(() => expect(hook.result.current[0]).toBe('rita'));
  });

  it('never accepts an unavailable recipient from storage or a selection event', async () => {
    localStorage.setItem(key, 'unavailable');
    const hook = renderHook(() => useCheckoutRecipient('dicolore', 'store', 'user', '98596', options, true, true));
    await waitFor(() => expect(hook.result.current[0]).toBe('rita'));
    act(() => hook.result.current[1]('unavailable'));
    expect(hook.result.current[0]).toBe('rita');
    expect(localStorage.getItem(key)).toBe('rita');
  });

  it('waits for recipients before restoring, without erasing the saved preference', async () => {
    localStorage.setItem(key, 'grazi');
    const hook = renderHook(({ ready, rows }) => useCheckoutRecipient('dicolore', 'store', 'user', '98596', rows, ready, true), {
      initialProps: { ready: false, rows: [] as OrderRecipient[] },
    });
    expect(hook.result.current[0]).toBe('');
    expect(localStorage.getItem(key)).toBe('grazi');
    hook.rerender({ ready: true, rows: options });
    await waitFor(() => expect(hook.result.current[0]).toBe('grazi'));
  });

  it('keeps selection working if Safari storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const hook = renderHook(() => useCheckoutRecipient('dicolore', 'store', 'user', '98596', options, true, true));
    await waitFor(() => expect(hook.result.current[0]).toBe('rita'));
    act(() => hook.result.current[1]('grazi'));
    expect(hook.result.current[0]).toBe('grazi');
  });

  it('does not pick a portfolio default or persist preferences for other stores', () => {
    const hook = renderHook(() => useCheckoutRecipient('jewosnewborn', 'store', 'user', '98596', options, true, true));
    expect(hook.result.current[0]).toBe('');
    act(() => hook.result.current[1]('grazi'));
    expect(hook.result.current[0]).toBe('grazi');
    expect(localStorage.length).toBe(0);
  });
});