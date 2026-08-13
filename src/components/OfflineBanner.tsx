import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export default function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground">
      <WifiOff className="h-3.5 w-3.5" />
      Sem conexão — modo offline. Os pedidos ficam na fila e são enviados quando a internet voltar.
    </div>
  );
}