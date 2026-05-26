import { useEffect, useState } from 'react';
import { isStoreOpen, type StoreOpenStatus } from '@/lib/businessHours';
import type { Store } from '@/types';

export function useStoreOpen(store?: Store | null): StoreOpenStatus {
  const [status, setStatus] = useState<StoreOpenStatus>(() =>
    store ? isStoreOpen(store.settings) : { open: true }
  );

  useEffect(() => {
    if (!store) { setStatus({ open: true }); return; }
    const recompute = () => setStatus(isStoreOpen(store.settings));
    recompute();
    const id = window.setInterval(recompute, 60_000);
    return () => window.clearInterval(id);
  }, [store]);

  return status;
}