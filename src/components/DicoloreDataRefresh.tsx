import { useEffect } from 'react';
import { useIsRestoring, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { useStoreBySlug } from '@/hooks/useStores';
import { useAuth } from '@/hooks/useAuth';
import { refreshDicoloreData, SCREEN_DATA } from '@/lib/dicoloreRefresh';

/** Only visible, mounted store data is refreshed; cart/auth storage is untouched. */
export default function DicoloreDataRefresh() {
  const { pathname } = useLocation();
  const slug = pathname.split('/')[1];
  const { data: store } = useStoreBySlug(slug === 'dicolore' ? slug : '');
  const { user } = useAuth();
  const client = useQueryClient();
  const restoring = useIsRestoring();
  useEffect(() => {
    if (restoring || slug !== 'dicolore' || !store?.id) return;
    const refresh = () => { void refreshDicoloreData(client, slug, store.id, SCREEN_DATA); };
    refresh();
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    window.addEventListener('online', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [client, restoring, slug, store?.id, pathname, user?.id]);
  return null;
}