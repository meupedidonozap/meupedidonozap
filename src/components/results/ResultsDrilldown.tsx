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

type Metric = 'pedidos' | 'vendido' | 'carteira' | 'faturado' | 'visitas' | 'clientes' | 'produtos';

interface Props {
  storeId: string;
  mode: 'vendedor' | 'televendas' | 'admin';
  sellerCodes: string[];
  userId?: string;
  userEmail?: string;
  company?: string;
  /** Código ERP da operadora de televendas (pe001.pedotvcod) */
  erpCode?: string;
}

const normCode = (c: string | null | undefined) => String(c ?? '').trim().replace(/^0+(?=\d)/, '');

function ShareBar({ part, total, money = true }: { part: number; total: number; money?: boolean }) {
  const pct = total > 0 ? Math.min(100, (part / total) * 100) : 0;
  const f = (n: number) => money ? formatCurrency(n) : String(Math.round(n * 100) / 100);
  return (
    <div className="space-y-0.5">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
      <div className="text-[11px] text-muted-foreground">Televendas {f(part)} de {f(total)} da carteira ({pct.toFixed(1)}%)</div>
    </div>
  );
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

export default function ResultsDrilldown({ storeId, mode, sellerCodes, userId, userEmail, company, erpCode }: Props) {
  const [open, setOpen] = useState<Metric | null>(null);
  const [adminSeller, setAdminSeller] = useState<string>('all');
  const since = iso(startPrevMonth());
  const isTv = mode === 'televendas';

  const { data: sellers = [] } = useQuery({
    queryKey: ['results-sellers', storeId], enabled: mode === 'admin' || mode === 'televendas',
    queryFn: async () => (await supabase.from('store_sellers').select('code, name').eq('store_id', storeId).eq('is_active', true).order('name')).data || [],
  });
  const mySellerSet = new Set(sellerCodes.map(normCode));
  const selectableSellers = isTv ? (sellers as any[]).filter(s => mySellerSet.has(normCode(s.code))) : (sellers as any[]);
  const codes = mode === 'admin' ? (adminSeller === 'all' ? [] : [adminSeller])
    : isTv ? (adminSeller === 'all' ? sellerCodes : [adminSeller]) : sellerCodes;
  const codeVariants = useMemo(() => Array.from(new Set(codes.flatMap(c => [c, c.replace(/^0+/, ''), c.padStart(2, '0')]).filter(Boolean))), [codes.join(',')]);

  const { data, isLoading } = useQuery({
    queryKey: ['results-drill', storeId, mode, codeVariants.join(','), userEmail, company, since, erpCode],
    queryFn: async () => {
      let orders: { date: string; value: number; customer: string; key?: string; items?: any[]; seller?: string }[] = [];
      let portfolio: { date: string; value: number; customer: string; key: string; seller: string }[] = [];
      let tvFlagged = 0;
      if (isTv) {
        // Base igual ao relatório RTV307A: NFs dos vendedores atendidos (carteira); a parte do
        // televendas são as NFs cujo pedido foi emitido pela operadora (pedtelven=S, pedotvcod).
        const inv = await fetchAll<any>((f, t) => {
          let q = supabase.from('customer_invoices').select('data_emissao, valor_total_nota_fiscal, filial_codigo, cliente_codigo, pedido_codigo, vendedor_codigo')
            .eq('store_id', storeId).gte('data_emissao', since).range(f, t);
          if (codeVariants.length) q = q.in('vendedor_codigo', codeVariants);
          if (company) q = q.eq('filial_codigo', company);
          return q;
        });
        const tvRows = await fetchAll<any>((f, t) => {
          let q = supabase.from('erp_orders').select('external_key, pedido_televendas, televendas_codigo')
            .eq('store_id', storeId).eq('pedido_televendas', true).range(f, t);
          if (company) q = q.eq('filial_codigo', company);
          return q;
        });
        const keys = televendasOrderKeys(tvRows, erpCode || '');
        tvFlagged = keys.size;
        const mapped = inv.filter(i => i.data_emissao).map(i => ({
          date: i.data_emissao, value: Number(i.valor_total_nota_fiscal) || 0, customer: i.cliente_codigo,
          key: `${i.filial_codigo}|${i.pedido_codigo}`, seller: normCode(i.vendedor_codigo), isTv: isTelevendasInvoice(i, keys),
        }));
        portfolio = mapped;
        orders = mapped.filter(m => m.isTv);
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
      // customer names for ERP codes (plain object so cached data stays compatible)
      const names: Record<string, string> = {};
      {
        const cs = Array.from(new Set(orders.map(o => o.customer))).filter(Boolean);
        for (let i = 0; i < cs.length; i += 200) {
          const { data } = await supabase.from('customer_profiles').select('customer_code, name').eq('store_id', storeId).in('customer_code', cs.slice(i, i + 200));
          (data || []).forEach(p => { names[p.customer_code] = p.name; });
        }
      }
      return { orders, invoices, visits, names, portfolio };
    },
  });

  const now = new Date();
  const inCurMonth = (d: string) => { const x = new Date(d.length === 10 ? d + 'T12:00' : d); return x.getMonth() === now.getMonth() && x.getFullYear() === now.getFullYear(); };

  const cmp = useMemo(() => {
    if (!data) return null;
    const durRows = data.visits.map(v => ({ date: v.date, value: v.dur }));
    return {
      orders: comparePeriods(data.orders, now),
      portfolio: comparePeriods(data.portfolio, now),
      invoices: comparePeriods(data.invoices, now),
      visits: comparePeriods(durRows, now),
    };
  }, [data]);

  const topClients = useMemo(() => {
    if (!data) return [];
    const m = new Map<string, number>();
    data.orders.filter(o => inCurMonth(o.date)).forEach(o => m.set(o.customer, (m.get(o.customer) || 0) + o.value));
    const pf = new Map<string, number>();
    data.portfolio.filter(o => inCurMonth(o.date)).forEach(o => pf.set(o.customer, (pf.get(o.customer) || 0) + o.value));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c, v]) => ({ name: data.names[c] ? `${c} - ${data.names[c]}` : c, value: v, portfolio: pf.get(c) || 0 }));
  }, [data]);

  // Por vendedor: total da carteira x parte do televendas no mês
  const bySeller = useMemo(() => {
    if (!data || !isTv) return [];
    const m = new Map<string, { tv: number; total: number }>();
    data.portfolio.filter(o => inCurMonth(o.date)).forEach(o => { const e = m.get(o.seller) || { tv: 0, total: 0 }; e.total += o.value; m.set(o.seller, e); });
    data.orders.filter(o => inCurMonth(o.date)).forEach(o => { const e = m.get(o.seller!) || { tv: 0, total: 0 }; e.tv += o.value; m.set(o.seller!, e); });
    const nm = new Map((sellers as any[]).map(s => [normCode(s.code), s.name]));
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total).map(([c, v]) => ({ name: nm.get(c) ? `${c} - ${nm.get(c)}` : c, ...v }));
  }, [data, sellers]);

  const { data: topProducts = [], isLoading: prodLoading } = useQuery({
    queryKey: ['results-products', storeId, mode, codeVariants.join(','), data?.orders.length],
    enabled: open === 'produtos' && !!data,
    queryFn: async () => {
      const m = new Map<string, { name: string; qty: number; total: number; portfolioQty?: number }>();
      const cur = data!.orders.filter(o => inCurMonth(o.date));
      if (isTv) {
        const tvKeys = new Set(cur.map(o => o.key!).filter(Boolean));
        const allKeys = data!.portfolio.filter(o => inCurMonth(o.date)).map(o => o.key);
        const pq = new Map<string, number>();
        for (let i = 0; i < allKeys.length; i += 100) {
          const { data: rows } = await supabase.from('erp_order_items').select('order_key, produto_codigo, produto_descricao, quantidade, valor_total')
            .eq('store_id', storeId).in('order_key', allKeys.slice(i, i + 100)).range(0, 4999);
          (rows || []).forEach(r => {
            pq.set(r.produto_codigo, (pq.get(r.produto_codigo) || 0) + (Number(r.quantidade) || 0));
            if (!tvKeys.has(r.order_key)) return;
            const e = m.get(r.produto_codigo) || { name: `${r.produto_codigo} - ${r.produto_descricao || ''}`, qty: 0, total: 0 };
            e.qty += Number(r.quantidade) || 0; e.total += Number(r.valor_total) || 0; m.set(r.produto_codigo, e);
          });
        }
        m.forEach((e, k) => { e.portfolioQty = pq.get(k) || 0; });
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
    { k: 'vendido', t: isTv ? 'Total vendido pelo televendas' : 'Total vendido no mês', icon: DollarSign, v: formatCurrency(cmp.orders.current.total), change: cmp.orders.changeTotal },
    { k: 'carteira', t: 'Total da carteira no mês', icon: TrendingUp, v: formatCurrency(cmp.portfolio.current.total), change: cmp.portfolio.changeTotal, hide: !isTv },
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

  const titles: Record<Metric, string> = { carteira: 'Total da carteira x televendas', pedidos: 'Pedidos', vendido: 'Total vendido', faturado: 'Total faturado (NF)', visitas: 'Atendimentos (check-in)', clientes: 'Top 10 clientes do mês', produtos: 'Top 20 produtos do mês (quantidade)' };

  return (
    <div className="space-y-3">
      {(mode === 'admin' || isTv) && (
        <Select value={adminSeller} onValueChange={setAdminSeller}>
          <SelectTrigger className="w-full sm:w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isTv ? 'Todos os meus vendedores' : 'Todos os vendedores'}</SelectItem>
            {selectableSellers.map((s: any) => <SelectItem key={s.code} value={s.code}>{s.code} - {s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {isTv && <p className="text-sm text-muted-foreground">Pedidos emitidos por você (televendas) comparados com o total da carteira dos vendedores que você atende.</p>}
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
          {open === 'vendido' && detail(cmp.orders, true, isTv ? 'Valor dos pedidos emitidos por você no ERP (pedido televendas).' : 'Valor dos pedidos colocados.')}
          {open === 'carteira' && (
            <div className="space-y-4">
              <ShareBar part={cmp.orders.current.total} total={cmp.portfolio.current.total} />
              <div className="space-y-2 text-sm">
                <div className="font-semibold">Por vendedor (mês atual)</div>
                {bySeller.length === 0 && <p className="text-muted-foreground">Sem pedidos no mês.</p>}
                {bySeller.map(s => <div key={s.name} className="border-b pb-1.5"><div className="flex justify-between"><span>{s.name}</span><b>{formatCurrency(s.total)}</b></div><ShareBar part={s.tv} total={s.total} /></div>)}
              </div>
              {detail(cmp.portfolio, true, 'Valor total dos pedidos da carteira dos vendedores atendidos.')}
            </div>
          )}
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
              {topClients.map((c, i) => <li key={i} className="border-b py-1.5"><div className="flex justify-between gap-2"><span className="truncate">{i + 1}. {c.name}</span><b>{formatCurrency(c.value)}</b></div>{isTv && <ShareBar part={c.value} total={c.portfolio} />}</li>)}
            </ol>
          )}
          {open === 'produtos' && (prodLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
            <ol className="space-y-1 text-sm">
              {topProducts.length === 0 && <p className="text-muted-foreground">Sem itens no mês.</p>}
              {topProducts.map((p, i) => <li key={i} className="flex flex-wrap justify-between gap-2 border-b py-1.5"><span className="line-clamp-2">{i + 1}. {p.name}</span><span className="shrink-0 text-right"><b>{p.qty}</b> un<br /><span className="text-xs text-muted-foreground">{formatCurrency(p.total)}</span></span>{isTv && <div className="basis-full"><ShareBar part={p.qty} total={p.portfolioQty || 0} money={false} /></div>}</li>)}
            </ol>
          ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}
