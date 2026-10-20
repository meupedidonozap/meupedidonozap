import { useEffect, useRef, useState } from 'react';
import { Loader2, Play, Square, RefreshCw, Save } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type Stats = { located: number; pending: number; incompleto: number; naoEncontrado: number; erro: number; divergente: number };
const LABELS: Record<string, string> = { incompleto: 'Cadastro incompleto', nao_encontrado: 'Não encontrado', erro: 'Erro', divergente: 'Conferir CEP' };

async function call(storeId: string, action: string) {
  const { data, error } = await supabase.functions.invoke('geocode-batch', { body: { storeId, action } });
  if (error) {
    let msg = error.message;
    try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as Stats & { processed?: number };
}

export default function GeoBatchPanel({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const stop = useRef(false);
  const [filter, setFilter] = useState('incompleto');

  const loadStats = () => call(storeId, 'stats').then((s) => { setStats(s); setLoadError(null); }).catch((e) => setLoadError((e as Error).message));
  useEffect(() => { loadStats(); }, [storeId]);

  const { data: rows = [], refetch } = useQuery({
    queryKey: ['geo-failures', storeId, filter],
    queryFn: async () => {
      const { data } = await supabase.from('customer_profiles')
        .select('id,customer_code,name,address,number,neighborhood,city,uf,cep,geo_error,geo_formatted')
        .eq('store_id', storeId).eq('is_active', true).eq('geo_status', filter).order('name').limit(200);
      return data || [];
    },
  });

  const run = async () => {
    setRunning(true); stop.current = false;
    try {
      while (!stop.current) {
        const s = await call(storeId, 'run');
        setStats(s);
        if (!s.pending || !s.processed) break;
      }
      toast.success('Localização concluída');
    } catch (e) { toast.error('Falha: ' + (e as Error).message + ' — clique de novo para continuar'); }
    setRunning(false);
    refetch();
    qc.invalidateQueries({ queryKey: ['atendimento-customers', storeId] });
  };

  const retry = async () => {
    try { setStats(await call(storeId, 'retry')); refetch(); }
    catch (e) { toast.error('Falha: ' + (e as Error).message); }
  };

  return (
    <div className="space-y-3">
      <Card className="p-4 space-y-3">
        <div className="font-semibold">Localização dos clientes em lote</div>
        {stats ? (
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge>Localizados: {stats.located}</Badge>
            <Badge variant="secondary">Na fila: {stats.pending}</Badge>
            <Badge variant="outline">Incompletos: {stats.incompleto}</Badge>
            <Badge variant="outline">Não encontrados: {stats.naoEncontrado}</Badge>
            <Badge variant="outline">Conferir CEP: {stats.divergente}</Badge>
            <Badge variant="outline">Erros: {stats.erro}</Badge>
          </div>
        ) : <Loader2 className="h-4 w-4 animate-spin" />}
        <div className="flex flex-wrap gap-2">
          {running ? (
            <Button variant="destructive" onClick={() => { stop.current = true; }}><Square className="h-4 w-4 mr-1" /> Parar</Button>
          ) : (
            <Button onClick={run} disabled={!stats?.pending}><Play className="h-4 w-4 mr-1" /> Localizar {stats?.pending ?? ''} clientes</Button>
          )}
          {running && <span className="flex items-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Processando… pode parar e continuar depois.</span>}
          <Button variant="outline" onClick={retry} disabled={running}><RefreshCw className="h-4 w-4 mr-1" /> Tentar de novo os não encontrados</Button>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {Object.entries(LABELS).map(([k, l]) => (
            <Button key={k} size="sm" variant={filter === k ? 'default' : 'outline'} onClick={() => setFilter(k)}>{l}</Button>
          ))}
        </div>
        {rows.length === 0 && <div className="text-sm text-muted-foreground">Nenhum cliente nesta lista.</div>}
        {rows.map((r: any) => <FixRow key={r.id} row={r} onSaved={() => { refetch(); call(storeId, 'stats').then(setStats); }} />)}
      </Card>
    </div>
  );
}

function FixRow({ row, onSaved }: { row: any; onSaved: () => void }) {
  const [f, setF] = useState({ address: row.address, number: row.number, neighborhood: row.neighborhood, city: row.city, uf: row.uf, cep: row.cep });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('customer_profiles')
      .update({ ...f, geo_status: null, geo_error: null, geo_lat: null, geo_lng: null }).eq('id', row.id).select().single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Salvo — entra na fila para localizar');
    onSaved();
  };
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="text-sm font-medium">{row.customer_code} — {row.name}</div>
      <div className="text-xs text-muted-foreground">{row.geo_error}{row.geo_formatted ? ` · Google: ${row.geo_formatted}` : ''}</div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <Input className="md:col-span-2" placeholder="Logradouro" value={f.address} onChange={set('address')} />
        <Input placeholder="Nº" value={f.number} onChange={set('number')} />
        <Input placeholder="Bairro" value={f.neighborhood} onChange={set('neighborhood')} />
        <Input placeholder="Cidade" value={f.city} onChange={set('city')} />
        <div className="flex gap-2"><Input placeholder="UF" value={f.uf} onChange={set('uf')} /><Input placeholder="CEP" value={f.cep} onChange={set('cep')} /></div>
      </div>
      <Button size="sm" onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" /> Salvar e localizar de novo</Button>
    </div>
  );
}
