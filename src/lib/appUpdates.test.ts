import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

class Worker extends EventTarget {
  state = 'installing';
  scriptURL = 'https://example.test/sw.js';
  activate() { this.state = 'activated'; this.dispatchEvent(new Event('statechange')); }
}

beforeEach(() => { vi.resetModules(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('app updates', () => {
  it('announces an activated replacement even before the banner subscribes', async () => {
    const worker = new Worker();
    vi.stubGlobal('navigator', { serviceWorker: { controller: {} } });
    const updates = await import('./appUpdates');
    const registration = Object.assign(new EventTarget(), { active: {}, installing: worker });
    updates.observeAppRegistration(registration as unknown as ServiceWorkerRegistration);
    worker.activate();
    expect(updates.getUpdateAvailable()).toBe(true);
  });

  it('does not announce first installation as a new version', async () => {
    const worker = new Worker();
    vi.stubGlobal('navigator', { serviceWorker: { controller: null } });
    const updates = await import('./appUpdates');
    updates.observeAppRegistration(Object.assign(new EventTarget(), { active: null, installing: worker }) as unknown as ServiceWorkerRegistration);
    worker.activate();
    expect(updates.getUpdateAvailable()).toBe(false);
  });

  it('refreshes only the app worker and preserves cart and session storage', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const messagingUpdate = vi.fn();
    const reload = vi.fn();
    localStorage.setItem('cart_dicolore', 'saved-cart');
    localStorage.setItem('sb-test-auth-token', 'test-session');
    vi.stubGlobal('navigator', { onLine: true, serviceWorker: { getRegistrations: async () => [
      { active: { scriptURL: 'https://example.test/push-sw.js' }, update: messagingUpdate },
      { active: { scriptURL: 'https://example.test/sw.js' }, update },
    ] } });
    vi.stubGlobal('window', { location: { reload } });
    const { refreshApplication } = await import('./appUpdates');
    await refreshApplication();
    expect(update).toHaveBeenCalledOnce();
    expect(messagingUpdate).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledOnce();
    expect(localStorage.getItem('cart_dicolore')).toBe('saved-cart');
    expect(localStorage.getItem('sb-test-auth-token')).toBe('test-session');
  });

  it('does not reload offline', async () => {
    const reload = vi.fn();
    vi.stubGlobal('navigator', { onLine: false });
    vi.stubGlobal('window', { location: { reload } });
    const { refreshApplication } = await import('./appUpdates');
    await expect(refreshApplication()).rejects.toThrow('Conecte-se');
    expect(reload).not.toHaveBeenCalled();
  });
});