import { lazy, Suspense, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Loader2, Search, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';
import { analyzeClients, concentration, goalProgress, groupStats, normCode, pct, previousRange, type CA_Mix, type CA_InvoiceSummary, type CustomerRow } from '@/lib/clientAnalytics';
import type { ReportSheet } from '@/lib/attendanceExport';
import { analyticsRows as allRows } from '@/lib/analyticsRead';
import { clientPeriodBounds as bounds, DEFAULT_CLIENT_PERIOD } from '@/lib/clientPeriod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ClientLifecyclePanel from '@/components/ClientLifecyclePanel';
const ClientMapPanel = lazy(() => import('@/components/ClientMapPanel'));

type Cell = string | number;
type Row = Record<string, Cell>;

const todayIso = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const money = (n: number) => formatCurrency(n);
const pctLabel = (v: number | null) => (v === null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`);
const fmtD = (s: string | null) => (s ? s.split('-').reverse().join('/') : '—');

function DataTable({ rows }: { rows: Row[] }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / 50)), cur = Math.min(page, pages - 1);
  if (!rows.length) return <p className="py-8 text-center text-sm text-muted-foreground">Nenhum registro encontrado.</p>;
  const keys = Object.keys(rows[0]);
  return (
    <div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted"><tr>{keys.map(k => <th key={k} className="whitespace-nowrap p-2">{k}</th>)}</tr></thead>
          <tbody>{rows.slice(cur * 50, cur * 50 + 50).map((r, i) => <tr key={i} className="border-t">{keys.map(k => <td key={k} className="max-w-[260px] whitespace-nowrap p-2">{r[k]}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center justify-end gap-2 text-xs">
        <span>{rows.length} registros • {cur + 1}/{pages}</span>
        <Button size="sm" variant="outline" disabled={!cur} onClick={() => setPage(cur - 1)}>Anterior</Button>
        <Button size="sm" variant="outline" disabled={cur + 1 >= pages} onClick={() => setPage(cur + 1)}>Próxima</Button>
      </div>
    </div>
  );
}
function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-bold">{value}</p>{hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}</CardContent></Card>;
}
function HBar({ data, dataKey, label }: { data: Row[]; dataKey: string; label: string }) {
  return (
    <div style={{ height: Math.max(180, data.length * 26) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" tickFormatter={v => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
          <YAxis type="category" dataKey={label} width={140} tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v: number) => money(v)} />
          <Bar dataKey={dataKey} fill="hsl(var(--primary))" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface Props { storeId: string; sellerCodes: string[]; canManage: boolean }

export default function ClientIntelligencePanel({ storeId, sellerCodes, canManage }: Props) {
  const qc = useQueryClient();
  const today = todayIso();
  const [period, setPeriod] = useState(DEFAULT_CLIENT_PERIOD);
  const [custom, setCustom] = useState(bounds(DEFAULT_CLIENT_PERIOD, today));
  const [tab, setTab] = useState('carteira');
  const range = period === 'custom' ? custom : bounds(period, today);
  const valid = Boolean(range.from && range.to && range.from <= range.to && range.to <= today);
  const prev = valid ? previousRange(range) : range;
  const [seller, setSeller] = useState('all');
  const [city, setCity] = useState('all');
  const [abc, setAbc] = useState('all');
  const [status, setStatus] = useState('all');
  const [freq, setFreq] = useState('all');
  const [opp, setOpp] = useState('all');
  const [abcBy, setAbcBy] = useState<'seller' | 'city'>('seller');
  const [search, setSearch] = useState('');
  const [riskDays, setRiskDays] = useState(60);
  const [inactiveDays, setInactiveDays] = useState(120);
  const own = sellerCodes.map(normCode);
  const [exporting, setExporting] = useState(false);

  const base = useQuery({
    queryKey: ['client-intel-base', storeId, own.join(',')], staleTime: 5 * 60000, gcTime: 15 * 60000,
    queryFn: async () => {
      const { data: st, error } = await supabase.from('stores').select('slug, settings').eq('id', storeId).single();
      if (error) throw error;
      if (st.slug !== 'dicolore') throw new Error('Análise exclusiva da DiColore');
      const [customers, sellers] = await Promise.all([
        allRows<any>((f, t) => supabase.from('customer_profiles').select('customer_code, name, nome_fantasia, city, uf, seller_code, is_active, neighborhood, geo_lat, geo_lng, municipio_codigo_ibge').eq('store_id', storeId).neq('customer_code', '').order('id').range(f, t)),
        allRows<any>((f, t) => supabase.from('store_sellers').select('code, name').eq('store_id', storeId).order('id').range(f, t)),
      ]);
      const ca = ((st.settings as any)?.clientAnalytics || {}) as { goals?: Record<string, { revenue: number; buyers: number }>; lineMap?: Record<string, string> };
      return { customers, sellers, goals: ca.goals || {}, lineMap: ca.lineMap || {} };
    },
  });
  const invoicesQ = useQuery({
    queryKey: ['client-intel-invoices', storeId, own.join(','), range.from, range.to], enabled: valid && !!base.data, staleTime: 60000, retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('client_invoice_analytics', { p_store_id: storeId, p_from: range.from, p_to: range.to });
      if (error) throw error;
      return data as unknown as { summaries: CA_InvoiceSummary[]; monthly: { code: string; month: string; value: number }[] };
    },
  });
  const mixQ = useQuery({
    queryKey: ['client-intel-mix', storeId, own.join(','), range.from, range.to], enabled: valid && !!invoicesQ.data && tab === 'produtos', staleTime: 5 * 60000, retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('client_mix_analytics', { p_store_id: storeId, p_from: range.from, p_to: range.to });
      if (error) throw error;
      return data as unknown as { mixCur: any[]; mixPrev: any[]; prodCur: any[]; prodPrev: any[] };
    },
  });

  const data = base.data;
  const sellerName = (c: string) => { const s = data?.sellers.find((x: any) => normCode(x.code) === c); return s ? `${c} — ${s.name}` : c || 'Sem vendedor'; };
  const scopedCustomers = useMemo(() => (data?.customers || []).filter((c: any) => !own.length || own.includes(normCode(c.seller_code))).map((c: any) => ({
    code: c.customer_code, name: c.nome_fantasia || c.name, city: c.city || '', uf: c.uf || '', seller: c.seller_code || '', active: c.is_active !== false,
    neighborhood: c.neighborhood || '', lat: c.geo_lat ?? null, lng: c.geo_lng ?? null, municipality: c.municipio_codigo_ibge || '',
  })), [data, own.join(',')]);
  const lineMap = data?.lineMap || {};
  const lineOf = (c: string) => lineMap[c] || c;

  const analysis = useMemo(() => {
    const mix: CA_Mix[] = [
      ...(mixQ.data?.mixCur || []).map((m: any) => ({ customer: m.cliente_codigo, category: m.categoria, value: Number(m.valor), period: 'cur' as const })),
      ...(mixQ.data?.mixPrev || []).map((m: any) => ({ customer: m.cliente_codigo, category: m.categoria, value: Number(m.valor), period: 'prev' as const })),
    ];
    return analyzeClients({
      customers: scopedCustomers, range, today, riskDays, inactiveDays, lineMap, abcBy, mix,
      invoices: [], invoiceSummaries: invoicesQ.data?.summaries, boundedHistory: true,
    });
  }, [data, invoicesQ.data, mixQ.data, scopedCustomers, range.from, range.to, riskDays, inactiveDays, abcBy, today]);

  const scopeRows = analysis.rows.filter(r => (seller === 'all' || r.seller === seller) && (city === 'all' || `${r.city}/${r.uf}` === city));
  const q = search.toLocaleLowerCase('pt-BR');
  const rows = scopeRows.filter(r => (abc === 'all' || r.abc === abc) && (status === 'all' || r.status === status) && (freq === 'all' || r.frequency === freq)
    && (opp === 'all' || r.opportunities.includes(opp)) && (!q || `${r.code} ${r.name} ${r.city}`.toLocaleLowerCase('pt-BR').includes(q)));
  const sellers = [...new Set(analysis.rows.map(r => r.seller))].filter(Boolean).sort((a, b) => Number(a) - Number(b));
  const cities = [...new Set(analysis.rows.filter(r => seller === 'all' || r.seller === seller).map(r => `${r.city}/${r.uf}`))].sort();
  const conc = concentration(rows);
  const revenue = rows.reduce((s, r) => s + r.revenue, 0), prevRevenue = rows.reduce((s, r) => s + r.prevRevenue, 0);
  const orders = rows.reduce((s, r) => s + r.orders, 0), buyers = rows.filter(r => r.orders > 0).length;
  const codes = new Set(rows.map(r => r.code));

  const custRow = (r: CustomerRow): Row => ({
    Código: r.code, Cliente: r.name, 'Cidade/UF': `${r.city}/${r.uf}`, Vendedor: sellerName(r.seller), ABC: r.abc, Situação: r.status,
    'Última compra': fmtD(r.lastPurchase), 'Dias sem comprar': r.daysSince ?? '—', Frequência: r.frequency, 'Intervalo médio (dias)': r.avgInterval ?? '—',
    'Pedidos período': r.orders, 'Faturado período': money(r.revenue), 'Ticket médio': money(r.ticket), 'Período anterior': money(r.prevRevenue),
    Variação: pctLabel(r.trend), Linhas: r.lines.join(', ') || '—', 'Linhas a ofertar': r.missingLines.join(', ') || '—', Oportunidades: r.opportunities.join(', ') || '—',
  });
  const portfolio = rows.slice().sort((a, b) => b.revenue - a.revenue).map(custRow);
  const abcRows = rows.filter(r => r.abc !== '-').sort((a, b) => b.revenue - a.revenue).map(r => ({
    ABC: r.abc, Código: r.code, Cliente: r.name, 'Cidade/UF': `${r.city}/${r.uf}`, Vendedor: sellerName(r.seller), Faturado: money(r.revenue),
    Participação: `${revenue ? ((r.revenue / revenue) * 100).toFixed(2) : '0'}%`, Anterior: money(r.prevRevenue), Variação: pctLabel(r.trend),
    Alerta: r.abc === 'A' && (r.trend ?? 0) <= -10 ? 'Cliente A reduzindo' : r.abc === 'C' && r.opportunities.includes('Potencial de crescimento') ? 'Potencial de crescimento' : r.trend !== null && r.trend >= 20 ? 'Crescendo' : '',
  }));
  const recovery = rows.filter(r => r.opportunities.some(o => ['Parou de comprar', 'Reduziu compras', 'Longo tempo sem pedido', 'Frequente com ticket baixo', 'Mix reduzido', 'Menor frequência'].includes(o)))
    .sort((a, b) => b.recovery - a.recovery || b.historyRevenue - a.historyRevenue).map(r => ({
      Código: r.code, Cliente: r.name, 'Cidade/UF': `${r.city}/${r.uf}`, Vendedor: sellerName(r.seller), Situação: r.status, 'Dias sem comprar': r.daysSince ?? '—',
      'Comprava (anterior)': money(r.prevRevenue), 'Compra (atual)': money(r.revenue), 'Oportunidade R$': money(r.recovery), 'Ticket atual': money(r.ticket), 'Ticket anterior': money(r.prevTicket),
      'Total no intervalo comparado': money(r.historyRevenue), Motivos: r.opportunities.join(', '), 'Linhas a ofertar': r.missingLines.join(', ') || '—',
    }));
  const recoveryTotal = rows.reduce((s, r) => s + r.recovery, 0);
  const cityStats = groupStats(rows, r => `${r.city}/${r.uf}`);
  const cityRows = cityStats.map(g => ({ 'Cidade/UF': g.key, Clientes: g.customers, Compradores: g.buyers, Positivação: `${g.positivation.toFixed(1)}%`, Faturado: money(g.revenue), Anterior: money(g.prevRevenue), Variação: pctLabel(g.trend), Participação: `${g.share.toFixed(1)}%`, 'Ticket médio': money(g.ticket), Leitura: g.customers >= 5 && g.positivation < 30 ? 'Baixa positivação — expansão' : g.trend !== null && g.trend < -15 ? 'Em queda' : g.trend !== null && g.trend > 15 ? 'Crescendo' : '' }));
  const sellerStats = groupStats(rows, r => r.seller).map(g => ({ ...g, conc: concentration(rows.filter(r => r.seller === g.key)) }));
  const sellerRows = sellerStats.map(g => ({ Vendedor: sellerName(g.key), Clientes: g.customers, Compradores: g.buyers, Positivação: `${g.positivation.toFixed(1)}%`, Faturado: money(g.revenue), Variação: pctLabel(g.trend), 'Clientes p/ 80%': g.conc.n80, 'Dependência top 5': `${g.conc.top5Share.toFixed(1)}%` }));

  // Produtos e linhas
  const inScope = (v: string) => (seller === 'all' ? !own.length || own.includes(normCode(v)) : normCode(v) === seller);
  const prodAgg = (list: any[]) => { const m = new Map<string, { name: string; line: string; value: number; qty: number; clients: number }>(); for (const p of list) { if (!inScope(p.vendedor_codigo)) continue; const e = m.get(p.produto_codigo) || m.set(p.produto_codigo, { name: p.produto_nome, line: lineOf(p.categoria), value: 0, qty: 0, clients: 0 }).get(p.produto_codigo)!; e.value += Number(p.valor); e.qty += Number(p.quantidade); e.clients += Number(p.clientes); } return m; };
  const pCur = prodAgg(mixQ.data?.prodCur || []), pPrev = prodAgg(mixQ.data?.prodPrev || []);
  const productRows = [...new Set([...pCur.keys(), ...pPrev.keys()])].map(k => { const c = pCur.get(k), p = pPrev.get(k); return { k, c, p }; })
    .sort((a, b) => (b.c?.value || 0) - (a.c?.value || 0)).map(({ k, c, p }) => ({ Código: k, Produto: c?.name || p?.name || k, Linha: c?.line || p?.line || '', Quantidade: Math.round(c?.qty || 0), Faturado: money(c?.value || 0), 'Clientes (aprox.)': c?.clients || 0, Anterior: money(p?.value || 0), Variação: pctLabel(pct(c?.value || 0, p?.value || 0)), Saída: !c ? 'Sem venda no período' : '' }));
  const lineAgg = (list: any[]) => { const m = new Map<string, { value: number; buyers: Set<string> }>(); for (const x of list) { if (!codes.has(normCode(x.cliente_codigo))) continue; const l = lineOf(x.categoria); const e = m.get(l) || m.set(l, { value: 0, buyers: new Set() }).get(l)!; e.value += Number(x.valor); e.buyers.add(normCode(x.cliente_codigo)); } return m; };
  const lCur = lineAgg(mixQ.data?.mixCur || []), lPrev = lineAgg(mixQ.data?.mixPrev || []);
  const lTotal = [...lCur.values()].reduce((s, v) => s + v.value, 0), lPrevTotal = [...lPrev.values()].reduce((s, v) => s + v.value, 0);
  const lineRows = [...new Set([...lCur.keys(), ...lPrev.keys()])].map(l => { const c = lCur.get(l), p = lPrev.get(l); const share = lTotal ? ((c?.value || 0) / lTotal) * 100 : 0, prevShare = lPrevTotal ? ((p?.value || 0) / lPrevTotal) * 100 : 0; return { Linha: l, Faturado: money(c?.value || 0), valor: c?.value || 0, Participação: `${share.toFixed(1)}%`, 'Part. anterior': `${prevShare.toFixed(1)}%`, Tendência: share - prevShare > 1 ? 'Ganhando participação' : share - prevShare < -1 ? 'Perdendo participação' : 'Estável', 'Clientes compradores': c?.buyers.size || 0, 'Compradores sem a linha': Math.max(0, buyers - (c?.buyers.size || 0)) }; }).sort((a, b) => b.valor - a.valor);
  const cityLine = new Map<string, Map<string, number>>();
  const cityOf = new Map(rows.map(r => [r.code, `${r.city}/${r.uf}`]));
  for (const x of mixQ.data?.mixCur || []) { const c = cityOf.get(normCode(x.cliente_codigo)); if (!c) continue; const m = cityLine.get(c) || cityLine.set(c, new Map()).get(c)!; const l = lineOf(x.categoria); m.set(l, (m.get(l) || 0) + Number(x.valor)); }
  const topLines = lineRows.slice(0, 8).map(l => l.Linha);
  const cityLineRows = [...cityLine.entries()].sort((a, b) => [...b[1].values()].reduce((s, v) => s + v, 0) - [...a[1].values()].reduce((s, v) => s + v, 0)).map(([c, m]) => {
    const r: Row = { 'Cidade/UF': c }; for (const l of topLines) r[l] = m.get(l) ? money(m.get(l)!) : '— não vendido'; return r;
  });
  const mixRows = rows.filter(r => r.missingLines.length).sort((a, b) => b.revenue - a.revenue).map(r => ({ Código: r.code, Cliente: r.name, 'Cidade/UF': `${r.city}/${r.uf}`, Vendedor: sellerName(r.seller), Faturado: money(r.revenue), 'Compra as linhas': r.lines.join(', '), 'Não compra': r.missingLines.join(', ') }));

  // Metas
  const [cityAll, setCityAll] = useState(false);
  const [goalDraft, setGoalDraft] = useState<Record<string, { revenue: number; buyers: number }> | null>(null);
  const [lineDraft, setLineDraft] = useState<Record<string, string> | null>(null);
  const goals = goalDraft || data?.goals || {};
  const goalRows = goalProgress(scopeRows, goals).filter(g => g.seller && (!own.length || own.includes(g.seller)));
  const save = async () => {
    const { error } = await supabase.rpc('save_client_analytics_settings', { p_store_id: storeId, p_settings: { goals, lineMap: lineDraft || lineMap } as any });
    if (error) { toast.error(error.message); return; }
    toast.success('Configurações salvas'); setGoalDraft(null); setLineDraft(null);
    qc.invalidateQueries({ queryKey: ['client-intel-base', storeId] });
  };
  const categories = [...new Set([...(mixQ.data?.mixCur || []), ...(mixQ.data?.mixPrev || [])].map((x: any) => x.categoria as string))].sort();
  const monthly = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of invoicesQ.data?.monthly || []) { if (!codes.has(normCode(i.code))) continue; m.set(i.month, (m.get(i.month) || 0) + Number(i.value)); }
    return [...m.entries()].sort().slice(-12).map(([Mês, v]) => ({ Mês, Faturado: v }));
  }, [invoicesQ.data, rows.map(r => r.code).join(',')]);

  const stamp = `${range.from}_a_${range.to}`;
  const sheets = (): ReportSheet[] => [
    { name: 'Resumo', rows: [{ Período: `${fmtD(range.from)} a ${fmtD(range.to)}`, 'Período anterior': `${fmtD(prev.from)} a ${fmtD(prev.to)}`, Vendedor: seller === 'all' ? 'Todos' : sellerName(seller), Cidade: city === 'all' ? 'Todas' : city, Clientes: rows.length, Compradores: buyers, Faturado: money(revenue), Anterior: money(prevRevenue), Variação: pctLabel(pct(revenue, prevRevenue)), 'Ticket médio': money(orders ? revenue / orders : 0), 'Clientes p/ 80%': conc.n80, 'Oportunidade de recuperação': money(recoveryTotal) }] },
    { name: 'Carteira', rows: portfolio }, { name: 'Curva ABC', rows: abcRows }, { name: 'Recuperação', rows: recovery },
    { name: 'Cidades', rows: cityRows }, { name: 'Vendedores', rows: sellerRows },
    ...(mixQ.data ? [{ name: 'Linhas', rows: lineRows.map(({ valor, ...r }) => r) }, { name: 'Produtos', rows: productRows }, { name: 'Linhas x Cidade', rows: cityLineRows }, { name: 'Mix a ampliar', rows: mixRows }] : []),
    { name: 'Metas', rows: goalRows.map(g => ({ Vendedor: sellerName(g.seller), 'Meta faturamento': money(g.goalRevenue), Faturado: money(g.revenue), 'Atingimento R$': g.revenuePct === null ? '—' : `${g.revenuePct.toFixed(1)}%`, 'Meta positivação': g.goalBuyers, Positivados: g.buyers, 'Atingimento posit.': g.buyersPct === null ? '—' : `${g.buyersPct.toFixed(1)}%` })) },
  ];
  const download = async (pdf: boolean) => {
    setExporting(true);
    try {
      const { exportAttendanceExcel, exportAttendancePdf } = await import('@/lib/attendanceExport');
      if (!pdf) exportAttendanceExcel(sheets(), stamp, 'clientes-dicolore');
      else exportAttendancePdf(sheets(), stamp, [
    { title: `Faturamento por cidade (${cityAll ? 'completa' : 'top 25'})`, labels: cityStats.slice(0, cityAll ? undefined : 25).map(c => c.key), values: cityStats.slice(0, cityAll ? undefined : 25).map(c => c.revenue) },
    { title: 'Faturamento por linha', labels: lineRows.map(l => l.Linha), values: lineRows.map(l => l.valor) },
    { title: 'Evolução mensal', labels: monthly.map(m => m.Mês), values: monthly.map(m => m.Faturado) },
      ], 'clientes-dicolore');
    } catch { toast.error('Não foi possível exportar.'); } finally { setExporting(false); }
  };

  if (base.isLoading || invoicesQ.isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (base.error || invoicesQ.error) return <div role="alert" className="py-8 text-center text-sm text-destructive"><p>Não foi possível carregar os clientes.</p><Button variant="outline" onClick={() => { base.refetch(); invoicesQ.refetch(); }}>Tentar novamente</Button></div>;
  const sel = (value: string, set: (v: string) => void, opts: [string, string][], ph: string) => (
    <Select value={value} onValueChange={set}><SelectTrigger className="h-9"><SelectValue placeholder={ph} /></SelectTrigger><SelectContent>{opts.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
          {sel(period, setPeriod, [['month', 'Este mês'], ['last', 'Mês passado'], ['60d', 'Últimos 60 dias'], ['90d', 'Últimos 90 dias'], ['180d', 'Últimos 180 dias'], ['365d', 'Últimos 12 meses'], ['year', 'Ano atual'], ['custom', 'De A até B']], 'Período')}
          {period === 'custom' && <div className="flex gap-1"><Input type="date" value={custom.from} max={today} onChange={e => setCustom({ ...custom, from: e.target.value })} /><Input type="date" value={custom.to} max={today} onChange={e => setCustom({ ...custom, to: e.target.value })} /></div>}
          {(!own.length || own.length > 1) && sel(seller, v => { setSeller(v); setCity('all'); }, [['all', 'Todos os vendedores'], ...sellers.map(s => [s, sellerName(s)] as [string, string])], 'Vendedor')}
          <div className="flex gap-1"><div className="min-w-0 flex-1">{sel(city, setCity, [['all', 'Todas as cidades'], ...cities.map(c => [c, c] as [string, string])], 'Cidade')}</div>{city !== 'all' && <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" aria-label="Limpar cidade" onClick={() => setCity('all')}><X className="h-4 w-4" /></Button>}</div>
          {!['ciclo', 'mapa'].includes(tab) && <>
          {sel(abc, setAbc, [['all', 'Curva ABC: todas'], ['A', 'Curva A'], ['B', 'Curva B'], ['C', 'Curva C'], ['-', 'Sem faturamento']], 'ABC')}
          {sel(status, setStatus, [['all', 'Situação: todas'], ['Ativo', 'Ativo'], ['Em risco', 'Em risco'], ['Inativo', 'Inativo'], ['Sem compras no intervalo', 'Sem compras no intervalo']], 'Situação')}
          {sel(freq, setFreq, [['all', 'Frequência: todas'], ...['Semanal', 'Quinzenal', 'Mensal', 'Bimestral', 'Trimestral', 'Esporádico', 'Compra única', 'Sem compras'].map(f => [f, f] as [string, string])], 'Frequência')}
          {sel(opp, setOpp, [['all', 'Oportunidade: todas'], ...['Parou de comprar', 'Reduziu compras', 'Menor frequência', 'Frequente com ticket baixo', 'Mix reduzido', 'Longo tempo sem pedido', 'Potencial de crescimento'].map(f => [f, f] as [string, string])], 'Oportunidade')}
          </>}
          <div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="h-9 pl-8" placeholder="Buscar cliente, código, cidade" value={search} onChange={e => setSearch(e.target.value)} /></div>
          {!['ciclo', 'mapa'].includes(tab) && <>
          <div className="flex items-center gap-1 text-xs">Em risco após<Input className="h-9 w-20" type="number" min={1} value={riskDays} onChange={e => setRiskDays(Math.max(1, Number(e.target.value) || 1))} />inativo após<Input className="h-9 w-20" type="number" min={1} value={inactiveDays} onChange={e => setInactiveDays(Math.max(riskDays + 1, Number(e.target.value) || 1))} />dias</div>
          <div className="flex gap-2"><Button size="sm" variant="outline" disabled={!valid || exporting || (tab === 'produtos' && (mixQ.isFetching || !mixQ.data))} onClick={() => download(false)}><Download className="mr-1 h-4 w-4" />Excel</Button><Button size="sm" variant="outline" disabled={!valid || exporting || (tab === 'produtos' && (mixQ.isFetching || !mixQ.data))} onClick={() => download(true)}><FileText className="mr-1 h-4 w-4" />PDF</Button></div>
          </>}
        </CardContent>
      </Card>
      {!valid && <p className="text-sm text-destructive">Informe um período válido.</p>}
      {!['ciclo', 'mapa'].includes(tab) && <>
      <p className="text-xs text-muted-foreground">Compras e frequência apuradas de {fmtD(prev.from)} a {fmtD(range.to)}: período selecionado e comparação anterior.</p>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
        <Kpi label="Clientes" value={String(rows.length)} hint={`${buyers} compraram (${rows.length ? ((buyers / rows.length) * 100).toFixed(1) : 0}%)`} />
        <Kpi label="Faturado" value={money(revenue)} hint={`Anterior ${money(prevRevenue)} (${pctLabel(pct(revenue, prevRevenue))})`} />
        <Kpi label="Ticket médio" value={money(orders ? revenue / orders : 0)} hint={`${orders} notas`} />
        <Kpi label="Concentração" value={`${conc.n80} clientes = 80%`} hint={`${conc.pct80.toFixed(1)}% dos compradores • top 5 = ${conc.top5Share.toFixed(1)}%`} />
        <Kpi label="Em risco / inativos" value={`${rows.filter(r => r.status === 'Em risco').length} / ${rows.filter(r => r.status === 'Inativo').length}`} />
        <Kpi label="Recuperação possível" value={money(recoveryTotal)} hint="Queda vs. período anterior" />
      </div>
      </>}
      {tab === 'produtos' && mixQ.isFetching && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Carregando produtos e linhas…</p>}
      {tab === 'produtos' && mixQ.isError && <div role="alert" className="text-sm text-destructive">Não foi possível carregar produtos e linhas. <Button variant="outline" size="sm" onClick={() => mixQ.refetch()}>Tentar novamente</Button></div>}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="carteira">Carteira e frequência</TabsTrigger>
          <TabsTrigger value="ciclo">Ciclo de vida</TabsTrigger>
          <TabsTrigger value="abc">Curva ABC</TabsTrigger>
          <TabsTrigger value="rec">Recuperação</TabsTrigger>
          <TabsTrigger value="cidades">Cidades</TabsTrigger>
          <TabsTrigger value="mapa">Mapa SC</TabsTrigger>
          <TabsTrigger value="produtos">Produtos e linhas</TabsTrigger>
          <TabsTrigger value="metas">Metas</TabsTrigger>
        </TabsList>
        <TabsContent value="ciclo">
          {tab === 'ciclo' && valid && <ClientLifecyclePanel storeId={storeId} customers={scopedCustomers} range={range} seller={seller} city={city} search={search} sellerName={sellerName} scopeKey={own.join(',')} />}
        </TabsContent>
        <TabsContent value="mapa">
          {tab === 'mapa' && valid && <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>}><ClientMapPanel storeId={storeId} customers={scopedCustomers} range={range} seller={seller} city={city} search={search} sellerName={sellerName} scopeKey={own.join(',')} onCity={setCity} /></Suspense>}
        </TabsContent>
        <TabsContent value="carteira" className="space-y-3">
          <div className="flex flex-wrap gap-1">{['Semanal', 'Quinzenal', 'Mensal', 'Bimestral', 'Trimestral', 'Esporádico', 'Compra única', 'Sem compras'].map(f => <Badge key={f} variant={freq === f ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setFreq(freq === f ? 'all' : f)}>{f}: {scopeRows.filter(r => r.frequency === f).length}</Badge>)}</div>
          <DataTable rows={portfolio} />
        </TabsContent>
        <TabsContent value="abc" className="space-y-3">
          <div className="flex items-center gap-2 text-sm">Curva calculada por {sel(abcBy, v => setAbcBy(v as 'seller' | 'city'), [['seller', 'Vendedor'], ['city', 'Cidade']], 'Agrupar')}</div>
          <div className="grid gap-2 sm:grid-cols-3">{(['A', 'B', 'C'] as const).map(k => { const l = rows.filter(r => r.abc === k); const v = l.reduce((s, r) => s + r.revenue, 0); return <Kpi key={k} label={`Curva ${k}`} value={`${l.length} clientes`} hint={`${money(v)} • ${revenue ? ((v / revenue) * 100).toFixed(1) : 0}% do faturamento`} />; })}</div>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Dependência por vendedor</CardTitle></CardHeader><CardContent><DataTable rows={sellerRows} /></CardContent></Card>
          <DataTable rows={abcRows} />
        </TabsContent>
        <TabsContent value="rec"><DataTable rows={recovery} /></TabsContent>
        <TabsContent value="cidades" className="space-y-3">
          <Card><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Faturamento por cidade ({cityAll ? `análise completa — ${cityStats.length}` : 'top 15'})</CardTitle><Button size="sm" variant={cityAll ? 'secondary' : 'outline'} onClick={() => setCityAll(!cityAll)}>{cityAll ? 'Ver top 15' : 'Análise completa'}</Button></CardHeader><CardContent><HBar data={cityStats.slice(0, cityAll ? undefined : 15).map(c => ({ Cidade: c.key, Faturado: c.revenue }))} dataKey="Faturado" label="Cidade" /></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Evolução mensal no intervalo comparado</CardTitle></CardHeader><CardContent><HBar data={monthly} dataKey="Faturado" label="Mês" /></CardContent></Card>
          <DataTable rows={cityRows} />
        </TabsContent>
        <TabsContent value="produtos" className="space-y-3">
          {mixQ.isSuccess && !lineRows.length && <p className="rounded-md border p-3 text-sm text-muted-foreground">Ainda não há itens de notas fiscais neste período.</p>}
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Participação por linha</CardTitle></CardHeader><CardContent className="space-y-3">{lineRows.length > 0 && <HBar data={lineRows.map(l => ({ Linha: l.Linha, Faturado: l.valor }))} dataKey="Faturado" label="Linha" />}<DataTable rows={lineRows.map(({ valor, ...r }) => r)} /></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Linhas por cidade</CardTitle></CardHeader><CardContent><DataTable rows={cityLineRows} /></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Clientes para ampliar o mix</CardTitle></CardHeader><CardContent><DataTable rows={mixRows} /></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Produtos (mais vendidos e com pouca saída)</CardTitle></CardHeader><CardContent><DataTable rows={productRows} /></CardContent></Card>
          {canManage && categories.length > 0 && (
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Agrupar categorias em linhas (ex.: Coloração, Tratamento, Finalização)</CardTitle></CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map(c => <label key={c} className="flex items-center gap-2 text-xs"><span className="w-40 truncate">{c}</span><Input className="h-8" placeholder={c} value={(lineDraft || lineMap)[c] || ''} onChange={e => setLineDraft({ ...(lineDraft || lineMap), [c]: e.target.value })} /></label>)}
                <Button size="sm" onClick={save} disabled={!lineDraft}>Salvar linhas</Button>
              </CardContent></Card>
          )}
        </TabsContent>
        <TabsContent value="metas" className="space-y-3">
          <p className="text-xs text-muted-foreground">Metas mensais aplicadas ao período selecionado. Positivação = clientes que compraram no período.</p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted"><tr>{['Vendedor', 'Meta faturamento', 'Faturado', 'Atingimento', 'Meta positivação', 'Positivados', 'Atingimento'].map((h, i) => <th key={i} className="whitespace-nowrap p-2">{h}</th>)}</tr></thead>
              <tbody>{goalRows.map(g => (
                <tr key={g.seller} className="border-t">
                  <td className="whitespace-nowrap p-2">{sellerName(g.seller)}</td>
                  <td className="p-2">{canManage ? <Input className="h-8 w-28" type="number" min={0} value={goals[g.seller]?.revenue ?? g.goalRevenue} onChange={e => setGoalDraft({ ...goals, [g.seller]: { revenue: Number(e.target.value) || 0, buyers: goals[g.seller]?.buyers ?? g.goalBuyers } })} /> : money(g.goalRevenue)}</td>
                  <td className="p-2">{money(g.revenue)}</td>
                  <td className="p-2"><Badge variant={(g.revenuePct ?? 0) >= 100 ? 'default' : 'outline'}>{g.revenuePct === null ? '—' : `${g.revenuePct.toFixed(1)}%`}</Badge></td>
                  <td className="p-2">{canManage ? <Input className="h-8 w-20" type="number" min={0} value={goals[g.seller]?.buyers ?? g.goalBuyers} onChange={e => setGoalDraft({ ...goals, [g.seller]: { revenue: goals[g.seller]?.revenue ?? g.goalRevenue, buyers: Number(e.target.value) || 0 } })} /> : g.goalBuyers}</td>
                  <td className="p-2">{g.buyers}</td>
                  <td className="p-2"><Badge variant={(g.buyersPct ?? 0) >= 100 ? 'default' : 'outline'}>{g.buyersPct === null ? '—' : `${g.buyersPct.toFixed(1)}%`}</Badge></td>
                </tr>))}</tbody>
            </table>
          </div>
          {canManage && <Button size="sm" onClick={save} disabled={!goalDraft}>Salvar metas</Button>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
