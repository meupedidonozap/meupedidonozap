import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import release from '../../public/release.json';

class Worker extends EventTarget {
  state = 'installing';
  scriptURL = 'https://example.test/sw.js';
  activate() { this.state = 'activated'; this.dispatchEvent(new Event('statechange')); }
}

beforeEach(() => { vi.resetModules(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('app updates', () => {
  it('a DiColore release targets only DiColore screens', async () => {
    const { requiresAppUpdate } = await import('./appUpdates');
    for (const screen of ['', '/checkout', '/vendedor/vendas', '/admin']) {
      expect(requiresAppUpdate({ version: 'new', stores: ['dicolore'] }, `/dicolore${screen}`, 'old')).toBe(true);
    }
    for (const slug of ['jewosnewborn', 'dicoloresenses', 'senses', 'mabelle', 'admin']) {
      expect(requiresAppUpdate({ version: 'new', stores: ['dicolore'] }, `/${slug}`, 'old')).toBe(false);
    }
  });
  it('the current release blocks no store, so nobody stays locked on the notice', async () => {
    const { requiresAppUpdate } = await import('./appUpdates');
    expect(release.stores).toEqual([]);
    for (const slug of ['dicolore', 'jewosnewborn', 'senses', 'limpa-telhas-brusque']) {
      expect(requiresAppUpdate({ version: 'new', stores: release.stores }, `/${slug}`, 'old')).toBe(false);
    }
  });
  it('lets the user continue after a failed attempt for the same version or after 15 seconds', async () => {
    const { canSkipUpdate } = await import('./appUpdates');
    expect(canSkipUpdate({ targetVersion: 'v2', attemptedVersion: null, waitedMs: 0 })).toBe(false);
    expect(canSkipUpdate({ targetVersion: 'v2', attemptedVersion: 'v1', waitedMs: 14_999 })).toBe(false);
    expect(canSkipUpdate({ targetVersion: 'v2', attemptedVersion: 'v2', waitedMs: 0 })).toBe(true);
    expect(canSkipUpdate({ targetVersion: 'v2', attemptedVersion: null, waitedMs: 15_000 })).toBe(true);
  });
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
    vi.stubGlobal('caches', { keys: async () => [], delete: async () => true });
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

  it('reloads from the network when the new worker does not take over, keeping cart, session and push', async () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    const unregister = vi.fn();
    const deleted: string[] = [];
    localStorage.setItem('cart_dicolore', 'saved-cart');
    vi.stubGlobal('caches', { keys: async () => ['workbox-precache-v2-https://example.test/', 'images', 'api-reads'], delete: async (name: string) => { deleted.push(name); return true; } });
    vi.stubGlobal('navigator', { onLine: true, serviceWorker: { getRegistrations: async () => [
      { active: { scriptURL: 'https://example.test/sw.js' }, installing: new Worker(), update: async () => undefined, unregister },
    ] } });
    vi.stubGlobal('window', { location: { reload } });
    const { refreshApplication, UPDATE_WAIT_MS } = await import('./appUpdates');
    const done = refreshApplication();
    await vi.advanceTimersByTimeAsync(UPDATE_WAIT_MS);
    await done;
    vi.useRealTimers();
    expect(deleted).toEqual(['workbox-precache-v2-https://example.test/']);
    expect(unregister).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledOnce();
    expect(localStorage.getItem('cart_dicolore')).toBe('saved-cart');
  });

  it('shows the release note once and only on the released store', async () => {
    const { releaseNoteFor, parseAppRelease } = await import('./appUpdates');
    const note = { id: 'r1', message: 'Novidade da versão.', stores: ['dicolore'] };
    expect(releaseNoteFor(note, '/dicolore/checkout', null)).toBe(note.message);
    expect(releaseNoteFor(note, '/dicolore', note.id)).toBeNull();
    expect(releaseNoteFor(note, '/jewosnewborn', null)).toBeNull();
    expect(parseAppRelease({ version: 'new', stores: ['dicolore'], message: note.message })?.message).toBe(note.message);
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