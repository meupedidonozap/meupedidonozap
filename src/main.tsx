import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import "./index.css";

// Auto-clear cache when ?limpar is in URL
if (window.location.search.includes('limpar')) {
  (async () => {
    // Preserve cart and auth session through the cleanup
    const preserved: Record<string, string> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.startsWith('cart_') || k.startsWith('sb-') || k.includes('supabase')) {
          const v = localStorage.getItem(k);
          if (v != null) preserved[k] = v;
        }
      }
    } catch {}

    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    // Restore preserved keys
    try {
      for (const [k, v] of Object.entries(preserved)) {
        if (localStorage.getItem(k) == null) localStorage.setItem(k, v);
      }
    } catch {}
    // Remove ?limpar and reload clean
    window.location.href = window.location.origin + window.location.pathname;
  })();
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

// Register service worker for push notifications (skip when ?limpar)
if ('serviceWorker' in navigator && !window.location.search.includes('limpar')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW register failed', err);
    });
  });
}
