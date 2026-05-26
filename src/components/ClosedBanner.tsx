import { Clock } from 'lucide-react';
import { useStoreOpen } from '@/hooks/useStoreOpen';
import type { Store } from '@/types';

interface Props { store?: Store | null; className?: string }

export default function ClosedBanner({ store, className }: Props) {
  const { open, message } = useStoreOpen(store);
  if (!store || open) return null;
  return (
    <div
      className={`flex items-center justify-center gap-2 border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-center text-sm font-medium text-destructive ${className || ''}`}
      role="status"
    >
      <Clock className="h-4 w-4" />
      <span>Loja fechada no momento.</span>
      {message && <span className="hidden sm:inline opacity-90">— {message}</span>}
    </div>
  );
}