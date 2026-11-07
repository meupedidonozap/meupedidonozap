import { useEffect, useState, useSyncExternalStore } from 'react';
import { getUpdateAvailable, subscribeToUpdates } from '@/lib/appUpdates';
import AppUpdateButton from './AppUpdateButton';

/**
 * Só avisa a loja envolvida: /release.json diz quais lojas a versão afeta
 * ({"stores": ["dicolore"]} ou {"stores": "all"}). As demais recebem a versão
 * nova em silêncio, na próxima abertura do app.
 */
export default function UpdateBanner() {
  const available = useSyncExternalStore(subscribeToUpdates, getUpdateAvailable, () => false);
  const [targeted, setTargeted] = useState(false);
  useEffect(() => {
    if (!available) return;
    const slug = window.location.pathname.split('/').filter(Boolean)[0] || '';
    fetch(`/release.json?t=${Date.now()}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { stores: 'all' }))
      .then((d: { stores?: string | string[] }) => {
        const s = d?.stores ?? 'all';
        setTargeted(s === 'all' || (Array.isArray(s) && s.includes(slug)));
      })
      .catch(() => setTargeted(true));
  }, [available]);
  if (!available || !targeted) return null;
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-3 top-3 z-[9999] mx-auto flex max-w-md flex-wrap items-center justify-between gap-3 rounded-lg border border-primary bg-card p-3 text-sm shadow-lg">
      <span className="min-w-0 font-medium">Nova versão disponível!</span>
      <AppUpdateButton />
    </div>
  );
}
