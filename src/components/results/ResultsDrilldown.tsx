import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, Loader2, Minus, TrendingUp, Users, Package, MapPin, ShoppingCart, Receipt, DollarSign } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';
import { comparePeriods, type DatedValue, type PeriodCompare } from '@/lib/periodCompare';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Metric = 'pedidos' | 'vendido' | 'faturado' | 'visitas' | 'clientes' | 'produtos';

interface Props {
  storeId: string;
  mode: 'vendedor' | 'televendas' | 'admin';
  sellerCodes: string[];
  userId?: string;
  userEmail?: string;
  company?: string;
}

const startPrevMonth = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() - 1, 1); };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtDur = (s: number) => { const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? `${h}h ${m}min` : `${m}min`; };

async function fetchAll<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function Change({ v }: { v: number | null }) {
  if (v === null) return <span className="text-xs text-muted-foreground">sem base</span>;
  const Icon = v > 0 ? ArrowUpRight : v < 0 ? ArrowDownRight : Minus;
  const cls = v > 0 ? 'text-success' : v < 0 ? 'text-destructive' : 'text-muted-foreground';
  return <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${cls}`}><Icon className="h-3.5 w-3.5" />{v > 0 ? '+' : ''}{v.toFixed(1)}%</span>;
}

export default function ResultsDrilldown({ storeId, mode, sellerCodes, userId, userEmail, company }: Props) {
  const [open, setOpen] = useState<Metric | null>(null);
  const [adminSeller, setAdminSeller] = useState<string>('all');
  const since = iso(startPrevMonth());
  const isTv = mode === 'televendas';

  const { data: sellers = [] } = useQuery({
    queryKey: ['results-sellers', storeId], enabled: mode === 'admin',
    queryFn: async () => (await supabase.from('store_sellers').select('code, name').eq('store_id', storeId).eq('is_active', true).order('name')).data || [],
  });
  const codes = mode === 'admin' ? (adminSeller === 'all' ? [] : [adminSeller]) : sellerCodes;
  const codeVariants = useMemo(() => Array.from(new Set(codes.flatMap(c => [c, c.replace(/^0+/, ''), c.padStart(2, '0')]).filter(Boolean))), [codes.join(',')]);

  const { data, isLoading } = useQuery({
    queryKey: ['results-drill', storeId, mode, codeVariants.join(','), userEmail, company, since],
    queryFn: async () => {
      let orders: { date: string; value: number; customer: string; key?: string; items?: any[] }[] = [];
      if (isTv) {
        const rows = await fetchAll<any>((f, t) => supabase.from('orders').select('created_at, total, status, customer, items')
          .eq('store_id', storeId).eq('customer->>createdByUserEmail', userEmail || '-').gte('created_at', since).range(f, t));
        orders = rows.filter(o => !['orcamento', 'cancelado'].includes(o.status)).map(o => ({
          date: o.created_at, value: Number(o.total) || 0, customer: o.customer?.name || o.customer?.customerCode || '-', items: o.items || [],
        }));
      }
      let invoices: DatedValue[] = [];
      let visits: { date: string; value: number; dur: number }[] = [];
      if (!isTv) {
        // Mesma base da tela Notas Fiscais: representante da NF (notrepcod)
        const inv = await fetchAll<any>((f, t) => {
          let q = supabase.from('customer_invoices').select('data_emissao, valor_total_nota_fiscal, filial_codigo, cliente_codigo, pedido_codigo')
            .eq('store_id', storeId).gte('data_emissao', since).range(f, t);
          if (codeVariants.length) q = q.in('vendedor_codigo', codeVariants);
          if (company) q = q.eq('filial_codigo', company);
          return q;
        });
        invoices = inv.map(i => ({ date: i.data_emissao, value: Number(i.valor_total_nota_fiscal) || 0 }));
        orders = inv.map(i => ({
          date: i.data_emissao, value: Number(i.valor_total_nota_fiscal) || 0, customer: i.cliente_codigo,
          key: i.pedido_codigo && i.pedido_codigo !== '0' ? `${i.filial_codigo}|${i.pedido_codigo}` : undefined,
        }));
        const vis = await fetchAll<any>((f, t) => {
          let q = supabase.from('customer_visits').select('checked_in_at, duration_seconds, seller_code, seller_user_id')
            .eq('store_id', storeId).gte('checked_in_at', since).range(f, t);
          if (mode === 'vendedor' && userId) q = q.eq('seller_user_id', userId);
          else if (codeVariants.length) q = q.in('seller_code', codeVariants);
          return q;
        });
        visits = vis.map(v => ({ date: v.checked_in_at, value: 1, dur: Number(v.duration_seconds) || 0 }));
      }
      // customer names for ERP codes
      const names = new Map<string, string>();
      if (!isTv) {
        const cs = Array.from(new Set(orders.map(o => o.customer))).filter(Boolean);
        for (let i = 0; i < cs.length; i += 200) {
          const { data } = await supabase.from('customer_profiles').select('customer_code, name').eq('store_id', storeId).in('customer_code', cs.slice(i, i + 200));
          (data || []).forEach(p => names.set(p.customer_code, p.name));
        }
      }
      return { orders, invoices, visits, names };
    },
  });

  const now = new Date();
  const inCurMonth = (d: string) => { const x = new Date(d.length === 10 ? d + 'T12:00' : d); return x.getMonth() === now.getMonth() && x.getFullYear() === now.getFullYear(); };

  const cmp = useMemo(() => {
    if (!data) return null;
    const durRows = data.visits.map(v => ({ date: v.date, value: v.dur }));
    return {
      orders: comparePeriods(data.orders, now),
      invoices: comparePeriods(data.invoices, now),
      visits: comparePeriods(durRows, now),
    };
  }, [data]);

  const topClients = useMemo(() => {
    if (!data) return [];
    const m = new Map<string, number>();
    data.orders.filter(o => inCurMonth(o.date)).forEach(o => m.set(o.customer, (m.get(o.customer) || 0) + o.value));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c, v]) => ({ name: data.names.get(c) ? `${c} - ${data.names.get(c)}` : c, value: v }));
  }, [data]);

  const { data: topProducts = [], isLoading: prodLoading } = useQuery({
    queryKey: ['results-products', storeId, mode, codeVariants.join(','), data?.orders.length],
    enabled: open === 'produtos' && !!data,
    queryFn: async () => {
      const m = new Map<string, { name: string; qty: number; total: number }>();
      const cur = data!.orders.filter(o => inCurMonth(o.date));
      if (isTv) {
        cur.forEach(o => (o.items || []).forEach((it: any) => {
          const k = it.code || it.productId || it.name; const e = m.get(k) || { name: `${it.code ? it.code + ' - ' : ''}${it.name || ''}`, qty: 0, total: 0 };
          e.qty += Number(it.quantity) || 0; e.total += (Number(it.price) || 0) * (Number(it.quantity) || 0); m.set(k, e);
        }));
      } else {
        const keys = cur.map(o => o.key!).filter(Boolean);
        for (let i = 0; i < keys.length; i += 100) {
          const { data: rows } = await supabase.from('erp_order_items').select('produto_codigo, produto_descricao, quantidade, valor_total')
            .eq('store_id', storeId).in('order_key', keys.slice(i, i + 100)).range(0, 4999);
          (rows || []).forEach(r => { const e = m.get(r.produto_codigo) || { name: `${r.produto_codigo} - ${r.produto_descricao || ''}`, qty: 0, total: 0 };
            e.qty += Number(r.quantidade) || 0; e.total += Number(r.valor_total) || 0; m.set(r.produto_codigo, e); });
        }
      }
      return [...m.values()].sort((a, b) => b.qty - a.qty).slice(0, 20);
    },
  });

  if (isLoading || !cmp || !data) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const totalDur = data.visits.filter(v => inCurMonth(v.date)).reduce((a, v) => a + v.dur, 0);
  const curVisits = cmp.visits.current.count;

  const cards: { k: Metric; t: string; icon: any; v: string; change?: number | null; hide?: boolean }[] = [
    { k: 'pedidos', t: isTv ? 'Pedidos emitidos no mês' : 'Pedidos do mês', icon: ShoppingCart, v: String(cmp.orders.current.count), change: cmp.orders.changeCount },
    { k: 'vendido', t: 'Total vendido no mês', icon: DollarSign, v: formatCurrency(cmp.orders.current.total), change: cmp.orders.changeTotal },
    { k: 'faturado', t: 'Faturado no mês (NF)', icon: Receipt, v: formatCurrency(cmp.invoices.current.total), change: cmp.invoices.changeTotal, hide: isTv },
    { k: 'visitas', t: 'Atendimentos no mês', icon: MapPin, v: `${curVisits} • hoje ${cmp.visits.today}`, change: cmp.visits.changeCount, hide: isTv },
    { k: 'clientes', t: 'Top 10 clientes', icon: Users, v: topClients[0] ? topClients[0].name.slice(0, 22) : '-' },
    { k: 'produtos', t: 'Top 20 produtos', icon: Package, v: 'Ver ranking' },
  ];

  const detail = (c: PeriodCompare, money: boolean, label: string) => {
    const f = (n: number) => money ? formatCurrency(n) : String(n);
    const pick = (x: { count: number; total: number }) => money ? x.total : x.count;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { t: 'Mês atual (até hoje)', v: f(pick(c.current)) },
            { t: `Mês anterior até dia ${c.day}`, v: f(pick(c.previousSameDays)) },
            { t: 'Mês anterior completo', v: f(pick(c.previous)) },
            { t: 'Variação mesmo período', v: <Change v={money ? c.changeTotal : c.changeCount} /> },
          ].map((x, i) => <div key={i} className="rounded-md border p-2"><div className="text-[11px] text-muted-foreground">{x.t}</div><div className="font-bold">{x.v}</div></div>)}
        </div>
        <div className="h-56">
          <ResponsiveContainer>
            <LineChart data={c.series}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="day" fontSize={11} />
              <YAxis fontSize={11} width={money ? 70 : 35} tickFormatter={(v) => money ? `${Math.round(v / 1000)}k` : v} />
              <Tooltip formatter={(v: any) => f(Number(v))} labelFormatter={(d) => `Dia ${d}`} />
              <Legend />
              <Line type="monotone" name="Mês atual" dataKey={money ? 'atual' : 'atualQtd'} stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" name="Mês anterior" dataKey={money ? 'anterior' : 'anteriorQtd'} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="max-h-64 overflow-auto rounded-md border text-sm">
          <table className="w-full">
            <thead className="sticky top-0 bg-muted"><tr><th className="p-1.5 text-left">Dia</th><th className="p-1.5 text-right">Atual (acum.)</th><th className="p-1.5 text-right">Anterior (acum.)</th></tr></thead>
            <tbody>{c.series.filter(s => s.atual !== null).map(s => (
              <tr key={s.day} className="border-t"><td className="p-1.5">{String(s.day).padStart(2, '0')}</td>
                <td className="p-1.5 text-right">{f(money ? s.atual! : s.atualQtd!)}</td>
                <td className="p-1.5 text-right">{f(money ? s.anterior : s.anteriorQtd)}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    );
  };

  const titles: Record<Metric, string> = { pedidos: 'Pedidos', vendido: 'Total vendido', faturado: 'Total faturado (NF)', visitas: 'Atendimentos (check-in)', clientes: 'Top 10 clientes do mês', produtos: 'Top 20 produtos do mês (quantidade)' };

  return (
    <div className="space-y-3">
      {mode === 'admin' && (
        <Select value={adminSeller} onValueChange={setAdminSeller}>
          <SelectTrigger className="w-full sm:w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os vendedores</SelectItem>
            {sellers.map((s: any) => <SelectItem key={s.code} value={s.code}>{s.code} - {s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {isTv && <p className="text-sm text-muted-foreground">Resultados dos pedidos emitidos por você.</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.filter(c => !c.hide).map(c => (
          <Card key={c.k} role="button" onClick={() => setOpen(c.k)} className="cursor-pointer transition hover:border-primary">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><c.icon className="h-4 w-4" />{c.t}</CardTitle></CardHeader>
            <CardContent className="flex items-end justify-between gap-2">
              <span className="truncate text-2xl font-bold">{c.v}</span>
              {c.change !== undefined && <Change v={c.change} />}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />{open && titles[open]}</DialogTitle></DialogHeader>
          {open === 'pedidos' && detail(cmp.orders, false, 'Quantidade de pedidos colocados, comparando os mesmos dias do mês anterior.')}
          {open === 'vendido' && detail(cmp.orders, true, 'Valor dos pedidos colocados.')}
          {open === 'faturado' && detail(cmp.invoices, true, 'Valor das notas fiscais emitidas (vendedor da NF).')}
          {open === 'visitas' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md border p-2"><div className="text-[11px] text-muted-foreground">Hoje</div><div className="font-bold">{cmp.visits.today}</div></div>
                <div className="rounded-md border p-2"><div className="text-[11px] text-muted-foreground">Tempo total no mês</div><div className="font-bold">{fmtDur(totalDur)}</div></div>
                <div className="rounded-md border p-2"><div className="text-[11px] text-muted-foreground">Média por visita</div><div className="font-bold">{curVisits ? fmtDur(totalDur / curVisits) : '-'}</div></div>
              </div>
              {detail(cmp.visits, false, 'Check-ins realizados, comparando os mesmos dias do mês anterior.')}
            </div>
          )}
          {open === 'clientes' && (
            <ol className="space-y-1 text-sm">
              {topClients.length === 0 && <p className="text-muted-foreground">Sem pedidos no mês.</p>}
              {topClients.map((c, i) => <li key={i} className="flex justify-between gap-2 border-b py-1.5"><span className="truncate">{i + 1}. {c.name}</span><b>{formatCurrency(c.value)}</b></li>)}
            </ol>
          )}
          {open === 'produtos' && (prodLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
            <ol className="space-y-1 text-sm">
              {topProducts.length === 0 && <p className="text-muted-foreground">Sem itens no mês.</p>}
              {topProducts.map((p, i) => <li key={i} className="flex justify-between gap-2 border-b py-1.5"><span className="line-clamp-2">{i + 1}. {p.name}</span><span className="shrink-0 text-right"><b>{p.qty}</b> un<br /><span className="text-xs text-muted-foreground">{formatCurrency(p.total)}</span></span></li>)}
            </ol>
          ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}
