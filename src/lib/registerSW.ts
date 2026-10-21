/**
 * Registro do service worker (offline + push).
 * Nunca registra em dev, dentro de iframe ou nos previews da Lovable.
 */
import { announceAppUpdate, observeAppRegistration } from './appUpdates';

const SW_URL = '/sw.js';

function isRefusedContext(): boolean {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return true;
  if (!import.meta.env.PROD) return true;
  try { if (window.self !== window.top) return true; } catch { return true; }
  const h = window.location.hostname;
  if (h.startsWith('id-preview--') || h.startsWith('preview--')) return true;
  if (h === 'lovableproject.com' || h.endsWith('.lovableproject.com')) return true;
  if (h === 'lovableproject-dev.com' || h.endsWith('.lovableproject-dev.com')) return true;
  if (h === 'beta.lovable.dev' || h.endsWith('.beta.lovable.dev')) return true;
  const params = new URLSearchParams(window.location.search);
  if (params.has('sw') && params.get('sw') === 'off') return true;
  if (window.location.search.includes('limpar')) return true;
  return false;
}

async function unregisterAppSW() {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) => [r.active, r.installing, r.waiting].some(worker => worker && new URL(worker.scriptURL).pathname === SW_URL))
        .map((r) => r.unregister()),
    );
  } catch {}
}

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (isRefusedContext()) {
    void unregisterAppSW();
    return;
  }
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) announceAppUpdate();
    hadController = true;
  });
  const register = () => {
    navigator.serviceWorker.register(SW_URL).then((reg) => {
      observeAppRegistration(reg);
      const check = () => { reg.update().catch(() => {}); };
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
      window.addEventListener('focus', check);
      window.addEventListener('pageshow', check);
      window.addEventListener('online', check);
      check();
    }).catch((err) => {
      console.warn('SW register failed', err);
    });
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}