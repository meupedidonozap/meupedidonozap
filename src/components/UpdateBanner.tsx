import { useEffect, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchAppRelease, getUpdateAvailable, requiresAppUpdate, subscribeToUpdates } from '@/lib/appUpdates';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import AppUpdateButton from './AppUpdateButton';

/**
 * Network version checks also work without a service worker. The affected store
 * cannot continue using an old bundle; storage is never cleared on refresh.
 */
export default function UpdateBanner() {
  const available = useSyncExternalStore(subscribeToUpdates, getUpdateAvailable, () => false);
  const { pathname } = useLocation();
  const [targeted, setTargeted] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let checking = false;
    setTargeted(false);
    const check = async () => {
      if (checking) return;
      checking = true;
      try {
        const release = await fetchAppRelease(controller.signal);
        if (!controller.signal.aborted && release) setTargeted(requiresAppUpdate(release, pathname));
      } catch {
        // A failed/offline check must not invent a release or dismiss an existing one.
      } finally { checking = false; }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    void check();
    const interval = window.setInterval(onVisible, 60_000);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('pageshow', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('pageshow', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, [available, pathname]);
  if (!targeted) return null;
  return (
    <AlertDialog open>
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md" onEscapeKeyDown={event => event.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Atualização obrigatória</AlertDialogTitle>
          <AlertDialogDescription>
            Uma nova versão desta loja está disponível. Atualize agora para continuar.
            Seu carrinho e sua conta serão preservados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter><AppUpdateButton /></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
