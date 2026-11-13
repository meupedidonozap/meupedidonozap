import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PERIODS = [
  { v: '0', l: 'Hoje' }, { v: '7', l: 'Últimos 7 dias' }, { v: '30', l: 'Últimos 30 dias' }, { v: '90', l: 'Últimos 90 dias' },
];

function fmtDur(s?: number | null) {
  if (!s) return '—';
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m} min`;
}
const fmt = (d?: string | null) => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

/** Visão de supervisão: check-ins de toda a equipe (Gerente/Admin). */
export default function TeamVisitsPanel({ storeId }: { storeId: string }) {
  const [period, setPeriod] = useState('7');
  const [seller, setSeller] = useState('all');

  const since = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - Number(period));
    return d.toISOString();
  }, [period]);

  const { data: users = [] } = useQuery({
    queryKey: ['team-sellers', storeId],
    queryFn: async () => {
      const { data } = await supabase.from('store_users').select('user_id, name, role').eq('store_id', storeId);
      return (data ?? []).filter((u: any) => u.role === 'vendedor' || u.role === 'televendas');
    },
  });

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['team-visits', storeId, since],
    queryFn: async () => {
      const { data, error } = await supabase.from('customer_visits')
        .select('id, seller_user_id, seller_code, customer_profile_id, checked_in_at, checked_out_at, duration_seconds, checkout_reason, checkout_notes, distance_meters_at_checkin, customer_profiles(name, customer_code, city)')
        .eq('store_id', storeId).gte('checked_in_at', since)
        .order('checked_in_at', { ascending: false }).limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const nameOf = (uid: string) => (users as any[]).find(u => u.user_id === uid)?.name || 'Vendedor';
  const rows = (visits as any[]).filter(v => seller === 'all' || v.seller_user_id === seller);
  const clients = new Set(rows.map(r => r.customer_profile_id)).size;
  const closed = rows.filter(r => r.duration_seconds);
  const avg = closed.length ? closed.reduce((a, r) => a + r.duration_seconds, 0) / closed.length : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <Select value={seller} onValueChange={setSeller}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os vendedores</SelectItem>
            {(users as any[]).slice().sort((a, b) => a.name.localeCompare(b.name)).map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{PERIODS.map(p => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 text-center"><div className="text-xl font-bold">{rows.length}</div><div className="text-xs text-muted-foreground">Visitas</div></Card>
        <Card className="p-3 text-center"><div className="text-xl font-bold">{clients}</div><div className="text-xs text-muted-foreground">Clientes</div></Card>
        <Card className="p-3 text-center"><div className="text-xl font-bold">{fmtDur(avg)}</div><div className="text-xs text-muted-foreground">Tempo médio</div></Card>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum atendimento no período.</p>
      ) : (
        <div className="space-y-2">
          {rows.map(v => (
            <Card key={v.id} className="p-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-semibold">{v.customer_profiles?.name || 'Cliente'}</span>
                <span className={v.checked_out_at ? 'text-muted-foreground' : 'font-semibold text-primary'}>{v.checked_out_at ? fmtDur(v.duration_seconds) : 'Em andamento'}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {nameOf(v.seller_user_id)} · Entrada {fmt(v.checked_in_at)} · Saída {fmt(v.checked_out_at)}
                {v.customer_profiles?.city ? ` · ${v.customer_profiles.city}` : ''}
              </div>
              {(v.checkout_reason || v.checkout_notes) && (
                <div className="mt-1 text-xs">{v.checkout_reason}{v.checkout_notes ? ` — ${v.checkout_notes}` : ''}</div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
