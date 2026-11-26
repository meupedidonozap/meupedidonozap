import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchWhatsAppLaunch } from './whatsAppLaunch';

describe('watchWhatsAppLaunch', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('avisa quando a tela continua aberta depois de 4 segundos', () => {
    const notOpened = vi.fn();
    watchWhatsAppLaunch(notOpened);
    vi.advanceTimersByTime(3999);
    expect(notOpened).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(notOpened).toHaveBeenCalledTimes(1);
  });

  it('não avisa quando a tela sai da frente porque o WhatsApp abriu', () => {
    const notOpened = vi.fn();
    watchWhatsAppLaunch(notOpened);
    window.dispatchEvent(new Event('blur'));
    vi.advanceTimersByTime(10000);
    expect(notOpened).not.toHaveBeenCalled();
  });

  it('não avisa depois de cancelado', () => {
    const notOpened = vi.fn();
    watchWhatsAppLaunch(notOpened)();
    vi.advanceTimersByTime(10000);
    expect(notOpened).not.toHaveBeenCalled();
  });
});
