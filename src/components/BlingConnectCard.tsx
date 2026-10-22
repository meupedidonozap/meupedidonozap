import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

export function BlingConnectCard({ storeId }: { storeId: string }) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.functions.invoke('bling-oauth', { body: { action: 'status', store_id: storeId } });
    setConnected(!!data?.connected);
  };
  useEffect(() => { load(); }, [storeId]);

  const connect = async () => {
    setBusy(true);
    const { data } = await supabase.functions.invoke('bling-oauth', { body: { action: 'authorize', store_id: storeId } });
    setBusy(false);
    if (data?.url) window.open(data.url, '_blank');
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border p-3 sm:max-w-md">
      <span className="text-sm">
        Conta Bling: <strong>{connected === null ? '...' : connected ? 'CONECTADA' : 'NÃO CONECTADA'}</strong>
      </span>
      <Button size="sm" onClick={connect} disabled={busy}>{connected ? 'Reconectar' : 'Conectar ao Bling'}</Button>
      <Button size="sm" variant="ghost" onClick={load}>Verificar</Button>
    </div>
  );
}
