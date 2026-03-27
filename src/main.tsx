import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import "./index.css";

// Auto-clear cache when ?limpar is in URL
if (window.location.search.includes('limpar')) {
  (async () => {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}
    // Remove ?limpar and reload clean
    window.location.href = window.location.origin + window.location.pathname;
  })();
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
