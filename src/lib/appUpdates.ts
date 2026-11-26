let available = false;
const listeners = new Set<() => void>();
export const CURRENT_APP_VERSION = import.meta.env.VITE_APP_BUILD_ID as string;

export const CURRENT_RELEASE_ID = (import.meta.env.VITE_APP_RELEASE_ID as string | undefined) || '';
export const CURRENT_RELEASE_MESSAGE = (import.meta.env.VITE_APP_RELEASE_MESSAGE as string | undefined) || '';
export const CURRENT_RELEASE_STORES = (import.meta.env.VITE_APP_RELEASE_STORES as string | string[] | undefined) || [];

export type AppRelease = { version: string; stores: string | string[]; message?: string };

/** Novidade da versão em execução, mostrada uma vez só nas lojas da release. */
export function releaseNoteFor(release: { id: string; message: string; stores: string | string[] }, pathname: string, seenId: string | null) {
  if (!release.id || !release.message || seenId === release.id) return null;
  return isReleaseForPath(release.stores, pathname) ? release.message : null;
}

export function parseAppRelease(value: unknown): AppRelease | null {
  if (!value || typeof value !== 'object') return null;
  const release = value as Record<string, unknown>;
  if (typeof release.version !== 'string' || !release.version) return null;
  if (release.stores !== 'all' && !(Array.isArray(release.stores) && release.stores.every(s => typeof s === 'string'))) return null;
  const message = typeof release.message === 'string' && release.message.trim() ? release.message.trim().slice(0, 300) : undefined;
  return { version: release.version, stores: release.stores as string | string[], ...(message ? { message } : {}) };
}

export function isReleaseForPath(stores: string | string[], pathname: string) {
  const slug = pathname.split('/').filter(Boolean)[0]?.toLowerCase();
  if (!slug || ['admin', 'redefinir-senha'].includes(slug)) return false;
  return stores === 'all' || (Array.isArray(stores) && (stores.includes('all') || stores.includes(slug)));
}

export function requiresAppUpdate(release: AppRelease, pathname: string, currentVersion = CURRENT_APP_VERSION) {
  return release.version !== currentVersion && isReleaseForPath(release.stores, pathname);
}

export async function fetchAppRelease(signal?: AbortSignal): Promise<AppRelease | null> {
  const response = await fetch(`/app-version.json?t=${Date.now()}`, { cache: 'no-store', signal });
  if (!response.ok) return null;
  return parseAppRelease(await response.json());
}

export const getUpdateAvailable = () => available;
export const subscribeToUpdates = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export function announceAppUpdate() {
  available = true;
  listeners.forEach(listener => listener());
}

export function observeAppRegistration(registration: ServiceWorkerRegistration) {
  const isUpdate = Boolean(registration.active || navigator.serviceWorker.controller);
  const observe = (worker: ServiceWorker | null) => {
    if (!worker) return;
    const check = () => {
      // First install is not an update. Auto-update activates the new worker.
      if (worker.state === 'activated' && isUpdate) announceAppUpdate();
    };
    worker.addEventListener('statechange', check);
  };
  observe(registration.installing);
  registration.addEventListener('updatefound', () => observe(registration.installing));
}

export const UPDATE_WAIT_MS = 8_000;
export const UPDATE_SKIP_AFTER_MS = 15_000;
const ATTEMPT_KEY = 'mpz:update-attempt';
const SKIPPED_KEY = 'mpz:update-skipped';

const sessionGet = (key: string) => { try { return sessionStorage.getItem(key); } catch { return null; } };
const sessionSet = (key: string, value: string) => { try { sessionStorage.setItem(key, value); } catch { /* storage unavailable */ } };
export const getUpdateAttempt = () => sessionGet(ATTEMPT_KEY);
export const markUpdateAttempt = (version: string) => sessionSet(ATTEMPT_KEY, version);
export const getSkippedUpdate = () => sessionGet(SKIPPED_KEY);
export const skipUpdate = (version: string) => sessionSet(SKIPPED_KEY, version);

/**
 * Ninguém fica preso no aviso: "Continuar" aparece quando a atualização para esta
 * versão já foi tentada e a tela antiga voltou, ou depois de alguns segundos de espera.
 */
export function canSkipUpdate(input: { targetVersion: string; attemptedVersion: string | null; waitedMs: number }) {
  return Boolean(input.targetVersion) && (input.attemptedVersion === input.targetVersion || input.waitedMs >= UPDATE_SKIP_AFTER_MS);
}

async function dropAppShellCache() {
  try {
    if (typeof caches === 'undefined') return;
    const names = await caches.keys();
    await Promise.allSettled(names.filter(name => /(^|-)precache-v\d+-/.test(name) || name === 'html-nav').map(name => caches.delete(name)));
  } catch { /* reload anyway */ }
}

export async function refreshApplication() {
  if (!navigator.onLine) throw new Error('Conecte-se à internet para atualizar.');
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const registration = registrations.find(reg =>
      [reg.active, reg.installing, reg.waiting].some(worker =>
        worker && new URL(worker.scriptURL).pathname === '/sw.js'));
    if (registration) {
      try {
        await registration.update();
        const worker = registration.installing || registration.waiting;
        if (worker && worker.state !== 'activated') {
          await new Promise<void>((resolve, reject) => {
            const finish = (error?: Error) => {
              clearTimeout(timer);
              worker.removeEventListener('statechange', check);
              if (error) reject(error); else resolve();
            };
            const check = () => {
              if (worker.state === 'activated') finish();
              if (worker.state === 'redundant') finish(new Error('redundant'));
            };
            const timer = setTimeout(() => finish(new Error('timeout')), UPDATE_WAIT_MS);
            worker.addEventListener('statechange', check);
            check();
          });
        }
      } catch { /* slow or failed replacement worker: the reload below still goes to the network */ }
    }
  }
  // Always drop the app-shell precache so the reload fetches the new version from the
  // network even when the old worker is still in control; the worker registration (and
  // its push subscription), storage, cart and session stay.
  await dropAppShellCache();
  // Do not clear storage, query persistence, carts, auth or messaging workers.
  window.location.reload();
}