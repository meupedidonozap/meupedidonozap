import { useState } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';

export default function CacheBuster() {
  const [clearing, setClearing] = useState(false);
  const [done, setDone] = useState(false);

  const handleClearCache = async () => {
    setClearing(true);
    try {
      // Clear all caches
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }

      // Unregister service workers
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }

      // Clear localStorage and sessionStorage
      try { localStorage.clear(); } catch {}
      try { sessionStorage.clear(); } catch {}

      setDone(true);

      // Force reload bypassing cache
      setTimeout(() => {
        window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now();
      }, 1500);
    } catch (err) {
      console.error('Erro ao limpar cache:', err);
      // Fallback: force reload
      window.location.reload();
    }
  };

  if (done) {
    return (
      <div className="fixed bottom-4 right-4 z-[9999] rounded-xl bg-green-600 px-5 py-3 text-white shadow-2xl animate-in fade-in">
        <p className="text-sm font-medium">✅ Cache limpo! Recarregando...</p>
      </div>
    );
  }

  return (
    <button
      onClick={handleClearCache}
      disabled={clearing}
      className="fixed bottom-4 right-4 z-[9999] flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-medium text-white shadow-2xl transition-all hover:bg-red-700 active:scale-95 disabled:opacity-70"
      title="Limpar cache e atualizar"
    >
      {clearing ? (
        <RefreshCw className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
      {clearing ? 'Limpando...' : 'Limpar Cache e Atualizar'}
    </button>
  );
}
