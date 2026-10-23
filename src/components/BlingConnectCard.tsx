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
  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('bling-sync', { body: { store_id: storeId, ...body } });
    if (error) {
      const ctx = (error as any)?.context;
      const txt = ctx?.text ? await ctx.text().catch(() => '') : '';
      throw new Error(txt || error.message);
    }
    if (data?.error) throw new Error(data.error === 'Bling não conectado' ? 'Bling desconectado — reconecte' : data.error);
    return data;
  };

  const importProducts = async () => {
    setBusy(true);
    try {
      setMsg('Lendo a lista de produtos do Bling...');
      const { items } = await call({ action: 'list' });
      // pais com variação primeiro; depois os simples que não forem variações
      const parents = items.filter((i: any) => i.formato === 'V');
      const rest = items.filter((i: any) => i.formato !== 'V');
      const variantCodes = new Set<string>();
      const tot = { created: 0, updated: 0, variants: 0, failed: 0, images: 0 };
      const jobs: any[] = [];
      const errors: string[] = [];
      const run = async (list: any[], done: number, total: number) => {
        for (let i = 0; i < list.length; i += 10) {
          const chunk = list.slice(i, i + 10).filter((x: any) => !variantCodes.has(x.codigo));
          setMsg(`Importando produtos ${Math.min(done + i + 10, total)} de ${total}...`);
          if (!chunk.length) continue;
          const r = await call({ action: 'products_batch', ids: chunk.map((x: any) => x.id) });
          tot.created += r.created; tot.updated += r.updated; tot.variants += r.variants; tot.failed += r.failed;
          (r.variantCodes || []).forEach((c: string) => variantCodes.add(c));
          jobs.push(...(r.images || []));
          errors.push(...(r.errors || []));
        }
      };
      await run(parents, 0, items.length);
      await run(rest, parents.length, items.length);
      for (let i = 0; i < jobs.length; i += 3) {
        setMsg(`Baixando fotos ${Math.min(i + 3, jobs.length)} de ${jobs.length}...`);
        try { const r = await call({ action: 'images_batch', jobs: jobs.slice(i, i + 3) }); tot.images += r.added; }
        catch (e) { errors.push((e as Error).message); }
      }
      setMsg(`Concluído: ${tot.created} produtos novos (inativos, para completar preço/categoria), ${tot.updated} atualizados, ${tot.variants} variantes, ${tot.images} fotos novas${tot.failed ? `, ${tot.failed} com erro` : ''}.${errors.length ? ' Erros: ' + errors.slice(0, 3).join(' | ') : ''}`);
    } catch (e) {
      setMsg('Erro: ' + (e as Error).message + ' — clique de novo para continuar; nada é duplicado.');
    } finally { setBusy(false); }
  };

  const sync = async (action: 'products' | 'customers') => {
    if (action === 'products') return importProducts();
    setBusy(true); setMsg('Sincronizando... pode levar alguns minutos.');
    try {
      const data = await call({ action });
      setMsg(`Clientes: ${data.total} lidos, ${data.created ?? 0} criados, ${data.updated} atualizados${data.failed ? `, ${data.failed} com erro` : ''}.`);
    } catch (e) { setMsg('Erro: ' + (e as Error).message); } finally { setBusy(false); }
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
          <Button size="sm" variant="outline" disabled={busy} onClick={() => sync('products')}>Sincronizar (inclui preços)</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => sync('customers')}>Importar clientes</Button>
        </div>
      )}
      {connected && <p className="text-xs text-muted-foreground">Automático a cada 15 min: nome, descrição, fotos, estoque, variantes e clientes. Preço só muda ao clicar em Sincronizar.</p>}
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}
