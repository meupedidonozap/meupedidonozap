import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { lifecycleRows, lifecycleStages, type LifecycleSummary } from '@/lib/clientLifecycle';
import { normCode, type CA_Customer, type CA_Range } from '@/lib/clientAnalytics';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const dateLabel = (s: string | null) => s ? s.split('-').reverse().join('/') : '—';
const intervalLabel = (n: number | null) => n === null ? 'Dados insuficientes' : `${n} dias`;

export default function ClientLifecyclePanel({ storeId, customers, range, seller, city, search, sellerName, scopeKey }: {
  storeId: string; customers: CA_Customer[]; range: CA_Range; seller: string; city: string; search: string; sellerName: (code: string) => string; scopeKey: string;
}) {
  const [stage, setStage] = useState('all');
  const [slowingOnly, setSlowingOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const query = useQuery({
    queryKey: ['client-lifecycle', storeId, scopeKey, range.to], staleTime: 5 * 60000, retry: 1,
    enabled: !!range.from && !!range.to && range.from <= range.to,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('client_lifecycle_days', { p_store_id: storeId, p_to: range.to });
      if (error) throw error;
      return data as unknown as LifecycleSummary;
    },
  });
  const all = useMemo(() => query.data ? lifecycleRows(customers, query.data, range) : [], [customers, query.data, range.from, range.to]);
  const scoped = all.filter(r => (seller === 'all' || r.seller === seller) && (city === 'all' || `${r.city}/${r.uf}` === city)
    && (!search || `${r.code} ${r.name} ${r.city}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))));
  const rows = scoped.filter(r => (stage === 'all' || r.stage === stage) && (!slowingOnly || r.slowing)).sort((a, b) => (b.daysSince ?? -1) - (a.daysSince ?? -1) || a.name.localeCompare(b.name));
  const pages = Math.max(1, Math.ceil(rows.length / 50)), currentPage = Math.min(page, pages - 1);
  const detail = rows.find(r => r.code === selected);
  const reportRows = rows.map(r => ({ Código: r.code, Cliente: r.name, Vendedor: sellerName(r.seller), 'Cidade/UF': `${r.city}/${r.uf}`, 'Ciclo de vida': r.stage,
    'Frequência em queda': r.slowing ? 'Sim' : 'Não', 'Intervalo histórico': intervalLabel(r.historical), 'Intervalo recente': intervalLabel(r.recent),
    'Última compra': dateLabel(r.last), 'Dias sem comprar': r.daysSince ?? '—', 'Primeira compra observada': dateLabel(r.first),
    'Reativado no período': r.returned ? 'Sim' : 'Não', 'Faturado no período': formatCurrency(r.revenue), 'Ticket médio': formatCurrency(r.ticket) }));
  const geo = new Map<string, { clients: number; buyers: number; risk: number; slowing: number; returned: number }>();
  for (const r of rows) {
    const key = `${r.city}/${r.uf}`;
    const g = geo.get(key) || { clients: 0, buyers: 0, risk: 0, slowing: 0, returned: 0 };
    g.clients++; if (r.invoices) g.buyers++; if (['Em risco', 'Inativo crítico'].includes(r.stage)) g.risk++; if (r.slowing) g.slowing++; if (r.returned) g.returned++;
    geo.set(key, g);
  }
  const cityRows = [...geo].sort(([a], [b]) => a.localeCompare(b)).map(([key, g]) => ({ 'Cidade/UF': key, Clientes: g.clients, Compradores: g.buyers, 'Positivação': `${(100 * g.buyers / g.clients).toFixed(1)}%`, 'Em risco/críticos': g.risk, 'Frequência em queda': g.slowing, Reativados: g.returned }));
  const download = async (pdf: boolean) => {
    setExporting(true);
    try {
      const { exportAttendanceExcel, exportAttendancePdf } = await import('@/lib/attendanceExport');
      const sheets = [{ name: 'Período', rows: [{ 'Histórico disponível': `${query.data?.from} a ${range.to}`, 'Período selecionado': `${range.from} a ${range.to}`, Situação: stage, 'Frequência em queda': slowingOnly ? 'Sim' : 'Todas', 'Vendedor': seller === 'all' ? 'Todos' : sellerName(seller), Cidade: city, Busca: search, 'Base': 'Notas fiscais autorizadas; ausência não comprova que nunca comprou' }] }, { name: 'Ciclo de vida', rows: reportRows }, { name: 'Cidades', rows: cityRows }];
      const stamp = `${range.from}_a_${range.to}`;
      if (pdf) exportAttendancePdf(sheets, stamp, [], 'ciclo-vida-dicolore');
      else exportAttendanceExcel(sheets, stamp, 'ciclo-vida-dicolore');
    } catch { toast.error('Não foi possível exportar.'); } finally { setExporting(false); }
  };
  if (query.isLoading) return <div className="flex items-center justify-center gap-2 py-12 text-sm"><Loader2 className="h-5 w-5 animate-spin" />Carregando histórico de compras…</div>;
  if (query.isError) return <div role="alert" className="py-6 text-sm text-destructive">Não foi possível carregar o ciclo de vida. <Button variant="outline" onClick={() => query.refetch()}>Tentar novamente</Button></div>;
  return <div className="space-y-4">
    <p className="text-xs text-muted-foreground">Histórico disponível: {dateLabel(query.data?.from ?? null)} a {dateLabel(range.to)}. Apenas notas autorizadas e já sincronizadas; ausência não comprova que nunca comprou. Primeira compra observada não comprova cliente novo.</p>
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {lifecycleStages.map(s => <Button key={s} variant={stage === s ? 'secondary' : 'outline'} className="h-auto min-h-16 flex-col items-start whitespace-normal text-left" onClick={() => { setStage(stage === s ? 'all' : s); setPage(0); }}><span className="text-xs">{s}</span><span className="text-xl font-bold">{scoped.filter(r => r.stage === s).length}</span></Button>)}
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <Select value={stage} onValueChange={v => { setStage(v); setPage(0); }}><SelectTrigger className="w-full sm:w-64" aria-label="Ciclo de vida"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os ciclos</SelectItem>{lifecycleStages.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={slowingOnly} onCheckedChange={v => { setSlowingOnly(v === true); setPage(0); }} />Frequência em queda</label>
      <Button size="sm" variant="outline" disabled={exporting || !query.data} onClick={() => download(false)}><Download className="mr-1 h-4 w-4" />Excel</Button>
      <Button size="sm" variant="outline" disabled={exporting || !query.data} onClick={() => download(true)}><FileText className="mr-1 h-4 w-4" />PDF</Button>
    </div>
    <p className="text-xs text-muted-foreground">Em risco: mais de 90 dias; crítico: 180 dias ou mais. Reativação: retorno no período após mais de 90 dias. Queda de frequência: intervalo recente pelo menos 50% maior que o anterior.</p>
    <div className="overflow-x-auto rounded-md border"><table className="w-full text-left text-xs"><thead className="bg-muted"><tr>{['Cliente', 'Vendedor', 'Cidade/UF', 'Ciclo de vida', 'Antes → recente', 'Dias sem comprar', 'Última compra', 'Faturado no período'].map(k => <th className="whitespace-nowrap p-2" key={k}>{k}</th>)}</tr></thead><tbody>
      {rows.slice(currentPage * 50, currentPage * 50 + 50).map(r => <tr key={r.code} className="border-t"><td className="min-w-48 p-2"><Button variant="link" className="h-auto max-w-64 whitespace-normal p-0 text-left text-xs" onClick={() => setSelected(r.code)}>{r.code} — {r.name}</Button></td><td className="whitespace-nowrap p-2">{sellerName(r.seller)}</td><td className="whitespace-nowrap p-2">{r.city}/{r.uf}</td><td className="whitespace-nowrap p-2">{r.stage}{r.slowing && <span className="block text-destructive">Frequência em queda</span>}</td><td className="whitespace-nowrap p-2">{intervalLabel(r.historical)} → {intervalLabel(r.recent)}</td><td className="p-2">{r.daysSince ?? '—'}</td><td className="whitespace-nowrap p-2">{dateLabel(r.last)}</td><td className="whitespace-nowrap p-2">{formatCurrency(r.revenue)}</td></tr>)}
    </tbody></table>{!rows.length && <p className="p-6 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</p>}</div>
    <div className="flex items-center justify-end gap-2 text-xs"><span>{rows.length} clientes • {currentPage + 1}/{pages}</span><Button size="sm" variant="outline" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Anterior</Button><Button size="sm" variant="outline" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Próxima</Button></div>
    {detail && <section className="space-y-2 border-t pt-4"><div className="flex items-start justify-between gap-2"><h3 className="text-sm font-semibold">{detail.name} — Evolução das compras</h3><Button size="sm" variant="outline" onClick={() => setSelected(null)}>Fechar</Button></div><p className="text-xs text-muted-foreground">Primeira compra observada: {dateLabel(detail.first)} • Ticket do período: {formatCurrency(detail.ticket)}</p><div className="max-h-72 overflow-auto"><table className="w-full text-left text-xs"><thead className="bg-muted"><tr>{['Data', 'Intervalo desde compra anterior', 'Notas', 'Faturado'].map(k => <th key={k} className="p-2">{k}</th>)}</tr></thead><tbody>{detail.days.map((d, i) => <tr key={d.date} className="border-t"><td className="p-2">{dateLabel(d.date)}</td><td className="p-2">{i ? `${Math.round((Date.parse(d.date) - Date.parse(detail.days[i - 1].date)) / 86400000)} dias` : '—'}</td><td className="p-2">{d.invoices}</td><td className="p-2">{formatCurrency(Number(d.revenue))}</td></tr>)}</tbody></table></div></section>}
    <section className="space-y-2 border-t pt-4"><h3 className="text-sm font-semibold">Ciclo de vida por cidade</h3><div className="max-h-80 overflow-auto"><table className="w-full text-left text-xs"><thead className="bg-muted"><tr>{Object.keys(cityRows[0] || { Cidade: '' }).map(k => <th key={k} className="whitespace-nowrap p-2">{k}</th>)}</tr></thead><tbody>{cityRows.map(r => <tr key={r['Cidade/UF']} className="border-t">{Object.entries(r).map(([k, v]) => <td className="whitespace-nowrap p-2" key={k}>{v}</td>)}</tr>)}</tbody></table></div></section>
  </div>;
}