import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useCheckoutRecipient } from './useCheckoutRecipient';
import type { OrderRecipient } from './useOrderRecipients';

const options: OrderRecipient[] = [
  { id: 'rita', name: 'Rita', whatsapp: '5548000000000', kind: 'vendedor' },
  { id: 'grazi', name: 'Televendas Grazi', whatsapp: '5547000000000', kind: 'televendas' },
];
const key = 'mpz_checkout_recipient:store:user:98596';
beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('DiColore checkout recipient', () => {
  it('starts blank even with a linked seller and a previously saved choice', () => {
    localStorage.setItem(key, 'grazi');
    const hook = renderHook(() => useCheckoutRecipient('dicolore', 'store', 'user', '98596', options, true));
    expect(hook.result.current[0]).toBe('');
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('starts blank when there is a single recipient', () => {
    const hook = renderHook(() => useCheckoutRecipient('dicolore', 'store', 'user', '98596', options.slice(0, 1), true));
    expect(hook.result.current[0]).toBe('');
  });

  it('keeps the chosen recipient for the current order and is blank when checkout reopens', () => {
    const first = renderHook(() => useCheckoutRecipient('dicolore', 'store', 'user', '98596', options, true));
    act(() => first.result.current[1]('grazi'));
    expect(first.result.current[0]).toBe('grazi');
    first.unmount();
    const reopened = renderHook(() => useCheckoutRecipient('dicolore', 'store', 'user', '98596', options, true));
    expect(reopened.result.current[0]).toBe('');
  });

  it('clears the choice when the customer changes', () => {
    const hook = renderHook(({ customer }) => useCheckoutRecipient('dicolore', 'store', 'user', customer, options, true), {
      initialProps: { customer: '98596' },
    });
    act(() => hook.result.current[1]('rita'));
    hook.rerender({ customer: 'other' });
    expect(hook.result.current[0]).toBe('');
  });

  it('never accepts an unavailable recipient or a choice before recipients load', () => {
    const hook = renderHook(({ ready }) => useCheckoutRecipient('dicolore', 'store', 'user', '98596', options, ready), {
      initialProps: { ready: false },
    });
    act(() => hook.result.current[1]('rita'));
    expect(hook.result.current[0]).toBe('');
    hook.rerender({ ready: true });
    act(() => hook.result.current[1]('unavailable'));
    expect(hook.result.current[0]).toBe('');
  });
});
