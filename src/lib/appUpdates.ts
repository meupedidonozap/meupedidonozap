let available = false;
const listeners = new Set<() => void>();

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

export async function refreshApplication() {
  if (!navigator.onLine) throw new Error('Conecte-se à internet para atualizar.');
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const registration = registrations.find(reg =>
      [reg.active, reg.installing, reg.waiting].some(worker =>
        worker && new URL(worker.scriptURL).pathname === '/sw.js'));
    if (registration) {
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
            if (worker.state === 'redundant') finish(new Error('Não foi possível atualizar. Tente novamente.'));
          };
          const timer = setTimeout(() => finish(new Error('A atualização ainda está sendo baixada. Tente novamente.')), 30_000);
          worker.addEventListener('statechange', check);
          check();
        });
      }
    }
  }
  // Do not clear storage, query persistence, carts, auth or messaging workers.
  window.location.reload();
}