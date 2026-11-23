import { describe, it, expect, vi } from 'vitest';
import { requestReleaseWhatsApp, RELEASE_WHATSAPP_EVENT, releaseAppUrl, storeBackPath } from './releaseWhatsApp';

describe('DiColore WhatsApp handoff', () => {
  it('offers the message without opening a tab or leaving the current order screen', () => {
    const listener = vi.fn();
    const open = vi.spyOn(window, 'open');
    const before = window.location.href;
    window.addEventListener(RELEASE_WHATSAPP_EVENT, listener);
    const url = 'https://wa.me/5547992491139?text=Pedido%20%23913';
    requestReleaseWhatsApp('dicolore', url);
    expect(open).not.toHaveBeenCalled();
    expect(window.location.href).toBe(before);
    expect((listener.mock.calls[0][0] as CustomEvent).detail.url).toBe(url);
    window.removeEventListener(RELEASE_WHATSAPP_EVENT, listener);
    open.mockRestore();
  });
  it('keeps the exact order number and destination in the native WhatsApp link', () => {
    expect(releaseAppUrl('https://wa.me/5547992491139?text=Pedido%20%23913')).toBe('whatsapp://send?phone=5547992491139&text=Pedido%20%23913');
  });
  it('rejects a different host rather than launching an arbitrary app link', () => {
    expect(() => releaseAppUrl('https://example.com/5547992491139')).toThrow();
  });
  it('returns DiColore users to their store rather than platform administration', () => {
    expect(storeBackPath('dicolore')).toBe('/dicolore');
  });
  it('preserves other stores navigation', () => {
    expect(storeBackPath('jewos')).toBe('/admin');
  });
  it('preserves legacy desktop handoff for other stores', () => {
    const legacy = { opener: {}, location: { href: '' } };
    requestReleaseWhatsApp('jewos', 'https://wa.me/5547992491139', legacy as unknown as Window);
    expect(legacy.location.href).toBe('https://wa.me/5547992491139');
    expect(legacy.opener).toBeNull();
  });
});