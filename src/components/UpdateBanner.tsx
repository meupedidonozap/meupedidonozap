import { useSyncExternalStore } from 'react';
import { getUpdateAvailable, subscribeToUpdates } from '@/lib/appUpdates';
import AppUpdateButton from './AppUpdateButton';

export default function UpdateBanner() {
  const show = useSyncExternalStore(subscribeToUpdates, getUpdateAvailable, () => false);
  if (!show) return null;
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-3 top-3 z-[9999] mx-auto flex max-w-md flex-wrap items-center justify-between gap-3 rounded-lg border border-primary bg-card p-3 text-sm shadow-lg">
      <span className="min-w-0 font-medium">Nova versão disponível!</span>
      <AppUpdateButton />
    </div>
  );
}
