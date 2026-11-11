import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

class Worker extends EventTarget {
  state = 'installing';
  scriptURL = 'https://example.test/sw.js';
  activate() { this.state = 'activated'; this.dispatchEvent(new Event('statechange')); }
}

beforeEach(() => { vi.resetModules(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('app updates', () => {
  it('requires JEWOS to update when its running version differs without any worker signal', async () => {
    const { requiresAppUpdate, getUpdateAvailable } = await import('./appUpdates');
    expect(getUpdateAvailable()).toBe(false);
    expect(requiresAppUpdate({ version: 'new', stores: ['jewosnewborn'] }, '/jewosnewborn', 'old')).toBe(true);
  });

  it.each(['admin', 'checkout', 'meus-dados', 'pedidos', 'pagar/123', 'vendedor'])('requires the update on the JEWOS %s screen', async screen => {
    const { requiresAppUpdate } = await import('./appUpdates');
    expect(requiresAppUpdate({ version: 'new', stores: ['jewosnewborn'] }, `/jewosnewborn/${screen}`, 'old')).toBe(true);
  });

  it.each(['dicolore', 'senses'])('does not interrupt %s for a JEWOS release', async slug => {
    const { requiresAppUpdate } = await import('./appUpdates');
    expect(requiresAppUpdate({ version: 'new', stores: ['jewosnewborn'] }, `/${slug}`, 'old')).toBe(false);
  });

  it('does not ask a current version to reload again', async () => {
    const { requiresAppUpdate } = await import('./appUpdates');
    expect(requiresAppUpdate({ version: 'current', stores: ['jewosnewborn'] }, '/jewosnewborn', 'current')).toBe(false);
  });

  it.each(['all', ['all']])('targets every store with the all release setting %j', async stores => {
    const { requiresAppUpdate } = await import('./appUpdates');
    expect(requiresAppUpdate({ version: 'new', stores }, '/senses/admin', 'old')).toBe(true);
    expect(requiresAppUpdate({ version: 'new', stores }, '/dicolore', 'old')).toBe(true);
    expect(requiresAppUpdate({ version: 'new', stores }, '/', 'old')).toBe(false);
    expect(requiresAppUpdate({ version: 'new', stores }, '/admin', 'old')).toBe(false);
  });

  it('never interprets missing or malformed release metadata as a global release', async () => {
    const { parseAppRelease } = await import('./appUpdates');
    expect(parseAppRelease({ stores: ['jewosnewborn'] })).toBeNull();
    expect(parseAppRelease({ version: 'new' })).toBeNull();
    expect(parseAppRelease({ version: 'new', stores: [7] })).toBeNull();
  });

  it('fetches current release from the network without using browser cache', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: 'new', stores: ['jewosnewborn'] }) });
    vi.stubGlobal('fetch', fetch);
    const { fetchAppRelease } = await import('./appUpdates');
    expect(await fetchAppRelease()).toEqual({ version: 'new', stores: ['jewosnewborn'] });
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/^\/app-version.json\?t=/), expect.objectContaining({ cache: 'no-store' }));
  });

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