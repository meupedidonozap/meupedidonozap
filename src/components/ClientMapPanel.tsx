import { lazy, Suspense, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, MapPin, X, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { lifecycleRows, lifecycleStages, type LifecycleSummary } from '@/lib/clientLifecycle';
import { locateClient, stageColors, normalizePlace, type GeoCustomer } from '@/lib/clientMap';
import type { CA_Range } from '@/lib/clientAnalytics';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
const ClientGeoMap = lazy(() => import('./ClientGeoMap'));

export default function ClientMapPanel({ storeId, customers, range, seller, city, search, sellerName, scopeKey, onCity }: {
  storeId: string; customers: GeoCustomer[]; range: CA_Range; seller: string; city: string; search: string; sellerName: (code: string) => string; scopeKey: string; onCity: (city: string) => void;
}) {
  const [stage, setStage] = useState('all');
  const [neighborhood, setNeighborhood] = useState('all');
  const [groupBy, setGroupBy] = useState('city');
  const [metric, setMetric] = useState('clients');
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [missingOnly, setMissingOnly] = useState(false);
  const [exporting, setExporting] = useState(false);
  const query = useQuery({
    queryKey: ['client-lifecycle', storeId, scopeKey, range.to], staleTime: 5 * 60000, retry: 1,
    queryFn: async () => { const { data, error } = await supabase.rpc('client_lifecycle_days', { p_store_id: storeId, p_to: range.to }); if (error) throw error; return data as unknown as LifecycleSummary; },
  });
  const all = useMemo(() => query.data ? lifecycleRows(customers, query.data, range) : [], [customers, query.data, range.from, range.to]);
  const geo = useMemo(() => new Map(customers.map(c => [c.code.replace(/^0+(?=\d)/, ''), c])), [customers]);
  const sc = all.filter(r => normalizePlace(r.uf) === 'SC' && (seller === 'all' || r.seller === seller) && (city === 'all' || normalizePlace(`${r.city}/${r.uf}`) === normalizePlace(city)) && (!search || normalizePlace(`${r.name} ${r.code} ${r.city} ${geo.get(r.code)?.neighborhood || ''}`).includes(normalizePlace(search))));
  const neighborhoods = [...new Set(sc.map(r => geo.get(r.code)?.neighborhood || 'Não informado'))].sort((a, b) => a.localeCompare(b));
  const effectiveNeighborhood = neighborhoods.includes(neighborhood) ? neighborhood : 'all';
  const rows = sc.filter(r => (stage === 'all' || r.stage === stage) && (effectiveNeighborhood === 'all' || (geo.get(r.code)?.neighborhood || 'Não informado') === effectiveNeighborhood)).map(r => { const g = geo.get(r.code); return { ...r, neighborhood: g?.neighborhood || 'Não informado', location: g ? locateClient(g) : null }; });
  const points = useMemo(() => rows.flatMap(r => r.location ? [{ ...r, ...r.location, seller: sellerName(r.seller) }] : []), [all, customers, seller, city, search, stage, effectiveNeighborhood]);
  const statusData = lifecycleStages.map(name => ({ name, count: rows.filter(r => r.stage === name).length })).filter(s => s.count);
  const [complete, setComplete] = useState(false);
  const groups = new Map<string, { name: string; cityKey: string; neighborhood: string; clients: number; revenue: number; buyers: number }>();
  for (const r of rows) { const name = groupBy === 'city' ? r.city : groupBy === 'seller' ? sellerName(r.seller) : `${r.neighborhood} • ${r.city}`; const key = normalizePlace(name); const g = groups.get(key) || { name, cityKey: `${r.city}/${r.uf}`, neighborhood: r.neighborhood, clients: 0, revenue: 0, buyers: 0 }; g.clients++; g.revenue += r.revenue; if (r.invoices) g.buyers++; groups.set(key, g); }
  const ranking = [...groups.values()].sort((a, b) => (metric === 'clients' ? b.clients - a.clients : b.revenue - a.revenue)).slice(0, complete ? undefined : 12);
  const list = rows.filter(r => !missingOnly || !r.location).sort((a, b) => a.name.localeCompare(b.name));
  const current = Math.min(page, Math.max(0, Math.ceil(list.length / 25) - 1));
  const detail = rows.find(r => r.code === selected);
  const download = async (pdf: boolean) => {
    setExporting(true);
    try {
      const { exportAttendanceExcel, exportAttendancePdf } = await import('@/lib/attendanceExport');
      const stamp = `${range.from}_a_${range.to}`;
      const sheets = [
        { name: 'Filtros', rows: [{ Período: `${range.from} a ${range.to}`, Vendedor: seller === 'all' ? 'Todos' : sellerName(seller), Cidade: city === 'all' ? 'Todas' : city, Bairro: effectiveNeighborhood === 'all' ? 'Todos' : effectiveNeighborhood, Status: stage === 'all' ? 'Todos' : stage, Busca: search, Clientes: rows.length }] },
        { name: 'Status', rows: statusData.map(s => ({ Status: s.name, Clientes: s.count, '%': `${(100 * s.count / rows.length).toFixed(1)}%` })) },
        { name: groupBy === 'city' ? 'Cidades' : groupBy === 'seller' ? 'Vendedores' : 'Bairros', rows: [...groups.values()].sort((a, b) => b.revenue - a.revenue).map(g => ({ Local: g.name, Clientes: g.clients, Compradores: g.buyers, Faturado: formatCurrency(g.revenue) })) },
        { name: 'Clientes', rows: [...rows].sort((a, b) => a.name.localeCompare(b.name)).map(r => ({ Código: r.code, Cliente: r.name, Vendedor: sellerName(r.seller), Cidade: r.city, Bairro: r.neighborhood, Status: r.stage, 'Dias sem comprar': r.daysSince ?? '—', Faturado: formatCurrency(r.revenue), Ticket: formatCurrency(r.ticket), Localização: r.location?.precision || 'Sem localização' })) },
      ];
      if (pdf) exportAttendancePdf(sheets, stamp, [
        { title: 'Clientes por status', labels: statusData.map(s => s.name), values: statusData.map(s => s.count) },
        { title: `${complete ? 'Análise completa' : 'Top 12'} ${groupBy === 'city' ? 'cidades' : groupBy === 'seller' ? 'vendedores' : 'bairros'} (${metric === 'clients' ? 'clientes' : 'faturamento'})`, labels: ranking.map(g => g.name), values: ranking.map(g => metric === 'clients' ? g.clients : g.revenue) },
      ], 'mapa-sc-dicolore');
      else exportAttendanceExcel(sheets, stamp, 'mapa-sc-dicolore');
    } catch { toast.error('Não foi possível exportar.'); } finally { setExporting(false); }
  };
  if (query.isLoading) return <div className="flex justify-center gap-2 py-12"><Loader2 className="h-5 w-5 animate-spin" />Carregando mapa e compras…</div>;
  if (query.isError) return <div role="alert" className="py-8 text-destructive">Não foi possível carregar o mapa. <Button variant="outline" onClick={() => query.refetch()}>Tentar novamente</Button></div>;
  return <div className="min-w-0 overflow-hidden space-y-4">
    <div className="flex flex-wrap items-end gap-3">
      <label className="w-full space-y-1 text-xs sm:w-64">Status<Select value={stage} onValueChange={v => { setStage(v); setPage(0); }}><SelectTrigger aria-label="Status no mapa"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem>{lifecycleStages.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></label>
      <label className="w-full space-y-1 text-xs sm:w-64">Bairro{city === 'all' && <span className="text-muted-foreground"> (todas as cidades)</span>}<div className="flex gap-1"><Select value={effectiveNeighborhood} onValueChange={v => { setNeighborhood(v); setPage(0); }}><SelectTrigger aria-label="Bairro no mapa"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os bairros</SelectItem>{neighborhoods.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent></Select>{effectiveNeighborhood !== 'all' && <Button size="icon" variant="outline" className="shrink-0" aria-label="Limpar bairro" onClick={() => setNeighborhood('all')}><X className="h-4 w-4" /></Button>}</div></label>
      {city !== 'all' && <Button variant="outline" onClick={() => { onCity('all'); setNeighborhood('all'); }}><X className="mr-1 h-4 w-4" />{city}</Button>}
      <Button variant="outline" disabled={exporting} onClick={() => download(false)}><Download className="mr-1 h-4 w-4" />Excel</Button>
      <Button variant="outline" disabled={exporting} onClick={() => download(true)}><FileText className="mr-1 h-4 w-4" />PDF</Button>
      <Button variant="outline" onClick={() => { onCity('all'); setNeighborhood('all'); setStage('all'); setMissingOnly(false); setSelected(null); }}>Limpar filtros do mapa</Button>
    </div>
    <div className="grid grid-cols-2 gap-3 border-y py-3 sm:grid-cols-4">
      {[['Clientes em SC', rows.length], ['Coordenadas cadastradas', rows.filter(r => r.location?.precision === 'Coordenada cadastrada').length], ['Referência municipal', rows.filter(r => r.location?.precision === 'Referência municipal aproximada').length], ['Sem localização', rows.filter(r => !r.location).length]].map(([label, value]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{value}</p></div>)}
    </div>
    <div className="flex flex-wrap gap-2">{lifecycleStages.map(s => <Button key={s} size="sm" variant={stage === s ? 'secondary' : 'outline'} className="h-auto whitespace-normal py-2 text-left text-xs" onClick={() => { setStage(stage === s ? 'all' : s); setPage(0); }}><MapPin className="mr-1 h-3 w-3 shrink-0" stroke={stageColors[s]} />{s}</Button>)}</div>
    <Suspense fallback={<div className="flex h-[480px] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}><ClientGeoMap points={points} onSelect={setSelected} /></Suspense>
    <p className="text-xs text-muted-foreground">Sem coordenadas cadastradas, o ponto representa o município, não o endereço ou bairro exato. {customers.filter(c => normalizePlace(c.uf) !== 'SC').length} clientes fora de SC ou sem UF não entram neste mapa. Histórico autorizado e sincronizado: {query.data?.from} a {range.to}; ausência de notas não comprova que nunca comprou.</p>
    {!rows.length && <p className="py-4 text-center text-muted-foreground">Nenhum cliente de SC nos filtros selecionados.</p>}
    {detail && <section className="space-y-2 border-y py-4"><div className="flex items-start justify-between gap-2"><h3 className="font-semibold">{detail.code} — {detail.name}</h3><Button size="sm" variant="outline" onClick={() => setSelected(null)}>Fechar</Button></div><p className="text-sm">{detail.neighborhood} • {detail.city}/SC • {sellerName(detail.seller)}</p><p className="text-sm">{detail.stage} • {detail.daysSince ?? '—'} dias sem comprar • Faturado: {formatCurrency(detail.revenue)} • Ticket: {formatCurrency(detail.ticket)}</p><p className="text-xs text-muted-foreground">Intervalo histórico: {detail.historical ?? '—'} dias • Recente: {detail.recent ?? '—'} dias • {detail.location?.precision || 'Sem localização'}</p></section>}
    <div className="grid min-w-0 gap-6 lg:grid-cols-2">
      <section className="min-w-0 space-y-2"><h3 className="text-sm font-semibold">Clientes por status</h3><div className="h-64">{statusData.length > 0 && <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} dataKey="count" nameKey="name" innerRadius={55} outerRadius={90} isAnimationActive={false}>{statusData.map(s => <Cell key={s.name} fill={stageColors[s.name]} />)}</Pie><Tooltip contentStyle={{ background: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', borderColor: 'hsl(var(--border))' }} /></PieChart></ResponsiveContainer>}</div><ul className="grid gap-1 text-xs sm:grid-cols-2">{statusData.map(s => <li key={s.name} className="flex justify-between gap-2"><span>{s.name}</span><strong>{s.count} ({(100 * s.count / rows.length).toFixed(1)}%)</strong></li>)}</ul></section>
      <section className="min-w-0 space-y-2"><h3 className="text-sm font-semibold">Distribuição — {complete ? `análise completa (${ranking.length})` : 'top 12'}</h3><div className="flex flex-wrap gap-2"><Select value={groupBy} onValueChange={setGroupBy}><SelectTrigger aria-label="Agrupar gráfico"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="city">Cidades</SelectItem><SelectItem value="neighborhood">Bairros</SelectItem><SelectItem value="seller">Vendedores</SelectItem></SelectContent></Select><Select value={metric} onValueChange={setMetric}><SelectTrigger aria-label="Métrica do gráfico"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="clients">Clientes</SelectItem><SelectItem value="revenue">Faturamento</SelectItem></SelectContent></Select><Button variant={complete ? 'secondary' : 'outline'} onClick={() => setComplete(!complete)}>{complete ? 'Ver top 12' : 'Análise completa'}</Button></div><div className="max-h-[600px] overflow-y-auto"><div style={{ height: Math.max(360, ranking.length * 26) }}>{ranking.length > 0 && <ResponsiveContainer width="100%" height="100%"><BarChart data={ranking} layout="vertical" margin={{ left: 0, right: 20 }}><CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : v} /><YAxis type="category" dataKey="name" width={125} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} /><Tooltip formatter={(v: number) => metric === 'revenue' ? formatCurrency(v) : v} contentStyle={{ background: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', borderColor: 'hsl(var(--border))' }} /><Bar dataKey={metric} name={metric === 'clients' ? 'Clientes' : 'Faturamento'} fill="hsl(var(--info))" isAnimationActive={false} /></BarChart></ResponsiveContainer>}</div></div><div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">{groupBy !== 'seller' && ranking.map(g => <Button key={g.name} size="sm" variant="outline" className="h-auto whitespace-normal py-1 text-xs" onClick={() => { onCity(g.cityKey); setNeighborhood(groupBy === 'neighborhood' ? g.neighborhood : 'all'); }}>{g.name}</Button>)}</div></section>
    </div>
    <section className="space-y-2 border-t pt-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="text-sm font-semibold">Clientes nos filtros</h3><Button variant={missingOnly ? 'secondary' : 'outline'} size="sm" onClick={() => { setMissingOnly(!missingOnly); setPage(0); }}>{missingOnly ? 'Mostrar todos' : 'Somente sem localização'}</Button></div><div className="overflow-x-auto rounded-md border"><table className="w-full text-left text-xs"><thead className="bg-muted"><tr>{['Cliente', 'Cidade / bairro', 'Status', 'Localização', 'Faturado'].map(s => <th key={s} className="whitespace-nowrap p-2">{s}</th>)}</tr></thead><tbody>{list.slice(current * 25, current * 25 + 25).map(r => <tr key={r.code} className="border-t"><td className="min-w-48 p-2"><Button variant="link" className="h-auto max-w-64 whitespace-normal p-0 text-left text-xs" onClick={() => setSelected(r.code)}>{r.code} — {r.name}</Button></td><td className="min-w-36 p-2">{r.city} / {r.neighborhood}</td><td className="min-w-32 p-2">{r.stage}</td><td className="min-w-36 p-2">{r.location?.precision || 'Sem localização'}</td><td className="whitespace-nowrap p-2">{formatCurrency(r.revenue)}</td></tr>)}</tbody></table>{!list.length && <p className="p-4 text-muted-foreground">Nenhum cliente encontrado.</p>}</div><div className="flex items-center justify-end gap-2 text-xs"><span>{list.length} clientes • Página {current + 1}</span><Button size="sm" variant="outline" disabled={!current} onClick={() => setPage(current - 1)}>Anterior</Button><Button size="sm" variant="outline" disabled={(current + 1) * 25 >= list.length} onClick={() => setPage(current + 1)}>Próxima</Button></div></section>
  </div>;
}