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

  const [msg, setMsg] = useState('');
  const sync = async (action: 'products' | 'customers') => {
    setBusy(true); setMsg('Sincronizando... pode levar alguns minutos.');
    const { data, error } = await supabase.functions.invoke('bling-sync', { body: { action, store_id: storeId } });
    setBusy(false);
    if (error || data?.error) { setMsg('Erro: ' + (data?.error || error?.message)); return; }
    setMsg(action === 'products'
      ? `Produtos: ${data.total} lidos, ${data.created} novos (inativos, para completar preço/fotos), ${data.stockUpdated} com estoque atualizado.`
      : `Clientes: ${data.total} lidos, ${data.created ?? 0} criados, ${data.updated} atualizados${data.failed ? `, ${data.failed} com erro` : ''}.`);
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 sm:max-w-md">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm">
          Conta Bling: <strong>{connected === null ? '...' : connected ? 'CONECTADA' : 'NÃO CONECTADA'}</strong>
        </span>
        <Button size="sm" onClick={connect} disabled={busy}>{connected ? 'Reconectar' : 'Conectar ao Bling'}</Button>
        <Button size="sm" variant="ghost" onClick={load}>Verificar</Button>
      </div>
      {connected && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => sync('products')}>Importar produtos e estoque</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => sync('customers')}>Atualizar clientes</Button>
        </div>
      )}
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}
