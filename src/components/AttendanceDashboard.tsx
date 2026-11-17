import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, FileText, Save, Search, RefreshCw } from 'lucide-react';
import { attendanceReport, codeKey, dayKey, durationLabel, periodBounds, validSettings, type AttendanceClient, type AttendanceVisit, type AttendancePurchase, type AttendanceSettings, type AttendanceHistory } from '@/lib/attendanceAnalytics';
import type { ReportSheet } from '@/lib/attendanceExport';

// Read every authorized page; an incomplete request must never masquerade as zero visits.
async function allRows<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await build(start, start + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}
type Seller = { code: string; name: string };
type LocalPurchase = { customer: unknown; status: string; created_at: string };
const fmtDate = (date: string | null) => date ? new Date(date.length === 10 ? date + 'T12:00:00' : date).toLocaleString('pt-BR', date.length === 10 ? { day: '2-digit', month: '2-digit', year: 'numeric' } : { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const percent = (part: number, total: number) => total ? `${(part * 100 / total).toFixed(1)}%` : '—';
function DataTable({ rows }: { rows: Record<string, string | number>[] }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / 50)), current = Math.min(page, pages - 1);
  const keys = Object.keys(rows[0] || {});
  if (!rows.length) return <p className="py-8 text-center text-muted-foreground">Nenhum registro encontrado.</p>;
  return <div><div className="overflow-x-auto rounded-md border"><table className="w-full text-left text-xs"><thead className="bg-muted"><tr>{keys.map(k => <th className="whitespace-nowrap p-3" key={k}>{k}</th>)}</tr></thead><tbody>{rows.slice(current * 50, current * 50 + 50).map((row, i) => <tr key={i} className="border-t">{keys.map(k => <td key={k} className="min-w-[90px] max-w-[260px] break-words p-3">{row[k]}</td>)}</tr>)}</tbody></table></div><div className="mt-3 flex items-center justify-end gap-3 text-sm"><span>{rows.length} registros • {current + 1}/{pages}</span><Button variant="outline" size="sm" disabled={!current} onClick={() => setPage(current - 1)}>Anterior</Button><Button variant="outline" size="sm" disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}>Próxima</Button></div></div>;
}
export default function AttendanceDashboard({ storeId }: { storeId: string }) {
  const cache = useQueryClient();
  const today = dayKey(new Date().toISOString());
  const [period, setPeriod] = useState('month');
  const [custom, setCustom] = useState(periodBounds('month', today));
  const [seller, setSeller] = useState('all');
  const [search, setSearch] = useState('');
  const [coverageFilter, setCoverageFilter] = useState('all');
  const [draft, setDraft] = useState<AttendanceSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [exporting, setExporting] = useState(false);
  const bounds = period === 'custom' ? custom : periodBounds(period, today);
  const validRange = Boolean(bounds.from && bounds.to && bounds.from <= bounds.to && bounds.to <= today);
  const base = useQuery({
    queryKey: ['attendance-management-base', storeId], staleTime: 5 * 60000, gcTime: 15 * 60000,
    queryFn: async () => {
      const { data: store, error } = await supabase.from('stores').select('slug, settings').eq('id', storeId).single();
      if (error) throw error;
      if (store.slug !== 'dicolore') throw new Error('Relatório exclusivo da DiColore');
      const [clients, sellers] = await Promise.all([
        allRows<AttendanceClient>((f, t) => supabase.from('customer_profiles').select('id, name, nome_fantasia, customer_code, seller_code, city, uf, data_ultima_compra, is_active, cpf_cnpj').eq('store_id', storeId).order('id').range(f, t)),
        allRows<Seller>((f, t) => supabase.from('store_sellers').select('code,name').eq('store_id', storeId).order('id').range(f, t)),
      ]);
      const settings = store.settings as unknown as { attendanceManagement?: AttendanceSettings; maxCheckinDistanceMeters?: number; titlesCompany?: string };
      return { clients, sellers, settings: settings.attendanceManagement || { staleDays: 90, goals: {} }, radius: settings.maxCheckinDistanceMeters || 300 };
    },
  });
  const previous = periodBounds('previous', today);
  const visitsFrom = bounds.from < previous.from ? bounds.from : previous.from;
  const visitsTo = bounds.to > today ? bounds.to : today;
  const query = useQuery({
    queryKey: ['attendance-management', storeId, bounds.from, bounds.to, visitsFrom, visitsTo],
    enabled: validRange && !!base.data, staleTime: 30000,
    queryFn: async () => {
      const [visits, summaryResult, localOrders] = await Promise.all([
        allRows<AttendanceVisit>((f, t) => supabase.from('customer_visits').select('id, seller_user_id, seller_code, customer_profile_id, checked_in_at, checked_out_at, duration_seconds, checkout_reason, checkout_notes, distance_meters_at_checkin, out_of_range_reason').eq('store_id', storeId).gte('checked_in_at', visitsFrom + 'T00:00:00-03:00').lte('checked_in_at', visitsTo + 'T23:59:59.999-03:00').order('id').range(f, t)),
        supabase.rpc('attendance_history_summary', { p_store_id: storeId, p_from: bounds.from, p_to: bounds.to }),
        allRows<LocalPurchase>((f, t) => supabase.from('orders').select('customer, status, created_at').eq('store_id', storeId).gte('created_at', bounds.from + 'T00:00:00-03:00').lte('created_at', bounds.to + 'T23:59:59.999-03:00').not('status', 'in', '(orcamento,cancelado)').order('id').range(f, t)),
      ]);
      if (summaryResult.error) throw summaryResult.error;
      const summary = summaryResult.data as unknown as AttendanceHistory & { purchases: AttendancePurchase[] };
      const clients = base.data?.clients || [];
      const byDocument = new Map(clients.filter(c => c.cpf_cnpj).map(c => [(c.cpf_cnpj || '').replace(/\D/g, ''), c.id]));
      const purchases: AttendancePurchase[] = localOrders.map(o => {
        const customer = o.customer as { customerCode?: string; cpfCnpj?: string };
        return { cliente_codigo: customer.customerCode || '', customer_profile_id: customer.customerCode ? undefined : byDocument.get((customer.cpfCnpj || '').replace(/\D/g, '')), data_emissao: dayKey(o.created_at), status: o.status };
      });
      return { visits, invoices: [...summary.purchases.map(p => ({ ...p, status: '100' })), ...purchases], summary };
    },
  });
  const data = useMemo(() => base.data ? { ...base.data, visits: query.data?.visits || [], invoices: query.data?.invoices || [], summary: query.data?.summary } : undefined, [base.data, query.data]);
  const config = draft || data?.settings || { staleDays: 90, goals: {} };
  const report = useMemo(() => attendanceReport(data?.clients || [], data?.visits || [], data?.invoices || [], bounds.from, bounds.to, seller, config.staleDays, data?.summary), [data, bounds.from, bounds.to, seller, config.staleDays]);
  const nameOf = (code: string | null) => { const key = codeKey(code); const match = data?.sellers.find(s => codeKey(s.code) === key); return match ? `${key} — ${match.name}` : key || 'Sem representante'; };
  const clientMap = useMemo(() => new Map(data?.clients.map(c => [c.id, c])), [data?.clients]);
  const matches = (values: (string | null | undefined)[]) => values.join(' ').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'));
  const visitRows = report.rows.filter(v => { const c = clientMap.get(v.customer_profile_id); return matches([c?.name, c?.nome_fantasia, c?.customer_code, c?.city, nameOf(v.seller_code)]); }).map(v => {
    const c = clientMap.get(v.customer_profile_id);
    return { Representante: nameOf(v.seller_code), Cliente: c?.customer_code || 'Sem código ERP', Nome: c?.nome_fantasia || c?.name || 'Cliente fora da carteira ativa', Cidade: `${c?.city || '—'}/${c?.uf || '—'}`, Entrada: fmtDate(v.checked_in_at), Saída: v.checked_out_at ? fmtDate(v.checked_out_at) : 'Em andamento', Tempo: durationLabel(v.duration_seconds), Localização: v.distance_meters_at_checkin == null ? 'Sem GPS' : v.distance_meters_at_checkin <= (data?.radius || 300) ? 'No raio do cliente' : 'Fora do raio', 'Distância (m)': v.distance_meters_at_checkin == null ? '—' : Math.round(v.distance_meters_at_checkin), Motivo: v.checkout_reason || '—', Observações: v.checkout_notes || '—', 'Motivo fora do raio': v.out_of_range_reason || '—' };
  });
  const coverageRows = report.coverage.filter(c => matches([c.name, c.nome_fantasia, c.customer_code, c.city, nameOf(c.seller_code)]) && (coverageFilter === 'all' || coverageFilter === 'visited' && c.visited || coverageFilter === 'unvisited' && !c.visited || coverageFilter === 'stale' && c.stale || coverageFilter === 'bought' && c.bought || coverageFilter === 'noPurchase' && c.visited && !c.bought)).sort((a, b) => b.revenue - a.revenue).map(c => ({ Representante: nameOf(c.seller_code), Cliente: c.customer_code || 'Sem código ERP', Nome: c.nome_fantasia || c.name, Cidade: `${c.city}/${c.uf}`, 'Última visita': c.last ? fmtDate(c.last) : 'Nunca registrada', 'Dias sem visita': c.days ?? 'Nunca registrada', 'Visitado no período': c.visited ? 'Sim' : 'Não', 'Compra após visita (pedido/NF)': c.bought ? 'Sim' : 'Não', 'Última compra ERP': fmtDate(c.data_ultima_compra), 'Faturamento histórico disponível': Math.round(c.revenue * 100) / 100 }));
  const representatives = [...new Set([...(data?.sellers.map(s => codeKey(s.code)) || []), ...(data?.visits.map(v => codeKey(v.seller_code)) || []), ...(data?.clients.map(c => codeKey(c.seller_code)) || [])])].filter(Boolean).sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'pt-BR'));
  const goalRows = representatives.filter(c => seller === 'all' || codeKey(seller) === c).map(code => {
    const team = report.rows.filter(v => codeKey(v.seller_code) === code), goal = config.goals[code];
    const closed = team.filter(v => v.checked_out_at && v.duration_seconds != null);
    const minutes = closed.length ? closed.reduce((a, v) => a + Number(v.duration_seconds), 0) / closed.length / 60 : 0;
    return { Representante: nameOf(code), Visitas: team.length, 'Clientes visitados': new Set(team.map(v => codeKey(clientMap.get(v.customer_profile_id)?.customer_code) || v.customer_profile_id)).size, 'Média visitas/dia útil': report.workdays ? (team.length / report.workdays).toFixed(2) : '—', 'Tempo médio (min)': minutes.toFixed(1), 'Meta visitas/dia útil': goal?.visitsPerDay || '—', 'Meta no período': goal ? goal.visitsPerDay * report.workdays : '—', 'Atingimento visitas': goal ? percent(team.length, goal.visitsPerDay * report.workdays) : '—', 'Meta tempo (min)': goal?.minutesPerVisit || '—', 'Atingimento tempo': goal && closed.length ? percent(minutes, goal.minutesPerVisit) : '—' };
  });
  const month = useMemo(() => attendanceReport([], data?.visits || [], [], `${today.slice(0, 7)}-01`, today, seller, config.staleDays), [data?.visits, today, seller, config.staleDays]);
  const prev = useMemo(() => attendanceReport([], data?.visits || [], [], previous.from, previous.to, seller, config.staleDays), [data?.visits, previous.from, previous.to, seller, config.staleDays]);
  let currentSum = 0, previousSum = 0;
  const comparison = Array.from({ length: Math.max(prev.daily.length, month.daily.length) }, (_, i) => { currentSum += month.daily[i]?.visits || 0; previousSum += prev.daily[i]?.visits || 0; return { day: i + 1, Atual: i < month.daily.length ? currentSum : null, Anterior: i < prev.daily.length ? previousSum : null }; });
  const summaries: Record<string, string | number>[] = [
    { Indicador: 'Visitas', Valor: report.rows.length }, { Indicador: 'Clientes visitados', Valor: report.visited }, { Indicador: 'Compraram após visita (pedido ou NF)', Valor: report.bought }, { Indicador: 'Visitados sem compra (pedido ou NF)', Valor: report.withoutPurchase }, { Indicador: 'Tempo médio', Valor: durationLabel(report.averageSeconds) }, { Indicador: 'Clientes ativos da carteira', Valor: report.coverage.length }, { Indicador: 'Clientes sem visita no período', Valor: report.coverage.filter(c => !c.visited).length }, { Indicador: `Clientes há mais de ${config.staleDays} dias / nunca visitados`, Valor: report.coverage.filter(c => c.stale).length },
  ];
  const sheets: ReportSheet[] = [{ name: 'Resumo', rows: summaries }, { name: 'Atendimentos', rows: visitRows }, { name: 'Clientes e cobertura', rows: coverageRows }, { name: 'Regiões', rows: report.regions.map(r => ({ Cidade: r.city, Carteira: r.clients, Visitados: r.visited, Cobertura: percent(r.visited, r.clients) })) }, { name: 'Metas e frequência', rows: goalRows }, { name: 'Por dia', rows: report.daily.map(d => ({ Dia: d.day, Visitas: d.visits, 'Tempo médio (min)': Number(d.minutes.toFixed(2)) })) }, { name: 'Motivos', rows: report.reasons.map(r => ({ Motivo: r.reason, Quantidade: r.count })) }, { name: 'Comparativo mensal', rows: comparison.map(d => ({ Dia: d.day, 'Mês atual acumulado': d.Atual ?? '—', 'Mês anterior acumulado': d.Anterior })) }];
  async function save() {
    if (!validSettings(config)) { setMessage('Informe metas válidas e um prazo entre 1 e 3650 dias.'); return; }
    setSaving(true); setMessage('');
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error('Entre novamente para salvar.');
      const { data: saved, error } = await supabase.rpc('save_attendance_settings', { p_store_id: storeId, p_settings: JSON.parse(JSON.stringify(config)) });
      if (error) throw error;
      if (!saved) throw new Error('A configuração não foi confirmada.');
      await cache.invalidateQueries({ queryKey: ['attendance-management-base', storeId] }); setDraft(null); setMessage('Metas e prazo salvos.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Não foi possível salvar.'); } finally { setSaving(false); }
  }
  async function download(pdf: boolean) {
    setExporting(true); setMessage('');
    try {
      const stamp = `${bounds.from}_a_${bounds.to}`;
      const { exportAttendancePdf, exportAttendanceExcel } = await import('@/lib/attendanceExport');
      if (pdf) exportAttendancePdf(sheets, stamp, [{ title: 'Atendimentos por dia', labels: report.daily.map(d => d.day), values: report.daily.map(d => d.visits) }, { title: 'Tempo médio por dia (minutos)', labels: report.daily.map(d => d.day), values: report.daily.map(d => d.minutes) }, { title: 'Motivos de encerramento', labels: report.reasons.map(r => r.reason), values: report.reasons.map(r => r.count) }]);
      else exportAttendanceExcel(sheets, stamp);
    } catch { setMessage('Não foi possível exportar o relatório.'); } finally { setExporting(false); }
  }
  if (base.isLoading || query.isLoading) return <p className="py-10 text-center text-muted-foreground">Carregando atendimentos e carteira…</p>;
  if (base.isError || query.isError) return <div role="alert" className="space-y-3 text-destructive"><p>Não foi possível carregar todos os dados de atendimento.</p><Button variant="outline" onClick={() => { base.refetch(); query.refetch(); }}><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button></div>;
  return <div className="min-w-0 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Visitas e cobertura de atendimento</h2><div className="flex gap-2"><Button variant="outline" size="sm" disabled={!validRange || exporting} onClick={() => download(true)}><FileText className="mr-2 h-4 w-4" />PDF</Button><Button variant="outline" size="sm" disabled={!validRange || exporting} onClick={() => download(false)}><Download className="mr-2 h-4 w-4" />Excel</Button></div></div>
    <div className="grid gap-3 sm:grid-cols-2"><Select value={seller} onValueChange={setSeller}><SelectTrigger aria-label="Representante"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toda a equipe</SelectItem>{representatives.map(c => <SelectItem key={c} value={c}>{nameOf(c)}</SelectItem>)}</SelectContent></Select><Select value={period} onValueChange={setPeriod}><SelectTrigger aria-label="Período"><SelectValue /></SelectTrigger><SelectContent>{[['today','Hoje'],['month','Este mês'],['previous','Mês passado'],['90','Últimos 90 dias'],['custom','De A até B']].map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
    {period === 'custom' && <div className="grid grid-cols-2 gap-3"><label className="text-sm">De<Input type="date" value={custom.from} max={today} onChange={e => setCustom({ ...custom, from: e.target.value })} /></label><label className="text-sm">Até<Input type="date" value={custom.to} max={today} onChange={e => setCustom({ ...custom, to: e.target.value })} /></label></div>}
    {!validRange ? <p role="alert" className="text-destructive">Informe um intervalo válido, até hoje.</p> : <>
    <p className="text-xs text-muted-foreground">{fmtDate(bounds.from)} a {fmtDate(bounds.to)} • {report.workdays} dias úteis (segunda a sexta) • Compras: pedidos realizados ou notas emitidas após a visita, dentro do período.</p>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Visitas',report.rows.length],['Clientes visitados',report.visited],['Tempo médio',durationLabel(report.averageSeconds)],['Conversão em compra',percent(report.bought,report.visited)],['Visitados com compra',report.bought],['Visitados sem compra',report.withoutPurchase],['Carteira sem visita',report.coverage.filter(c => !c.visited).length],[`Sem visita > ${config.staleDays} dias / nunca`,report.coverage.filter(c => c.stale).length]].map(([label,value]) => <div key={label} className="rounded-md border bg-card p-3"><div className="text-xl font-semibold">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>)}</div>
    <Tabs defaultValue="visits"><TabsList className="flex h-auto flex-wrap justify-start"><TabsTrigger value="visits">Atendimentos</TabsTrigger><TabsTrigger value="charts">Gráficos</TabsTrigger><TabsTrigger value="coverage">Cobertura</TabsTrigger><TabsTrigger value="goals">Metas</TabsTrigger></TabsList>
      <div className="relative my-4"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Buscar cliente" className="pl-9" placeholder="Cliente, código, cidade ou representante" value={search} onChange={e => setSearch(e.target.value)} /></div>
      <TabsContent value="visits"><DataTable rows={visitRows} /></TabsContent>
      <TabsContent value="charts" className="space-y-6">
        <section><h3 className="mb-3">Atendimentos por dia</h3><div className="h-64 w-full"><ResponsiveContainer><BarChart data={report.daily}><CartesianGrid stroke="hsl(var(--border))" vertical={false} /><XAxis dataKey="day" tickFormatter={d => String(d).slice(5)} /><YAxis allowDecimals={false} /><Tooltip /><Bar isAnimationActive={false} name="Visitas" dataKey="visits" fill="hsl(var(--success))" /></BarChart></ResponsiveContainer></div></section>
        <section><h3 className="mb-3">Tempo médio de atendimento por dia (minutos)</h3><div className="h-64 w-full"><ResponsiveContainer><LineChart data={report.daily}><CartesianGrid stroke="hsl(var(--border))" /><XAxis dataKey="day" tickFormatter={d => String(d).slice(5)} /><YAxis /><Tooltip /><Line isAnimationActive={false} name="Minutos" dataKey="minutes" stroke="hsl(var(--info))" dot={false} /></LineChart></ResponsiveContainer></div></section>
        <section><h3 className="mb-3">Motivos de encerramento</h3><div className="h-64 w-full"><ResponsiveContainer><BarChart data={report.reasons}><XAxis dataKey="reason" hide /><YAxis allowDecimals={false} /><Tooltip /><Bar isAnimationActive={false} name="Atendimentos" dataKey="count" fill="hsl(var(--warning))" /></BarChart></ResponsiveContainer></div><DataTable rows={sheets[6].rows} /></section>
        <section><h3 className="mb-3">Visitas acumuladas • mês atual × mês anterior</h3><div className="h-64 w-full"><ResponsiveContainer><LineChart data={comparison}><CartesianGrid stroke="hsl(var(--border))" /><XAxis dataKey="day" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Line isAnimationActive={false} dataKey="Atual" stroke="hsl(var(--success))" dot={false} /><Line isAnimationActive={false} dataKey="Anterior" stroke="hsl(var(--info))" dot={false} /></LineChart></ResponsiveContainer></div></section>
      </TabsContent>
      <TabsContent value="coverage" className="space-y-4"><Select value={coverageFilter} onValueChange={setCoverageFilter}><SelectTrigger aria-label="Cobertura"><SelectValue /></SelectTrigger><SelectContent>{[['all','Todos os clientes'],['visited','Visitados no período'],['unvisited','Sem visita no período'],['stale',`Sem visita há mais de ${config.staleDays} dias / nunca`],['bought','Visitados com compra'],['noPurchase','Visitados sem compra']].map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select><DataTable rows={coverageRows} /><h3>Cobertura por cidade</h3><DataTable rows={sheets[3].rows} /></TabsContent>
      <TabsContent value="goals" className="space-y-4"><label className="block max-w-xs text-sm">Dias sem visita<Input aria-label="Dias sem visita" type="number" min={1} max={3650} value={config.staleDays} onChange={e => setDraft({ ...config, staleDays: Number(e.target.value) })} /></label><p className="text-xs text-muted-foreground">Metas de visitas por dia útil e tempo médio mínimo por atendimento, em minutos.</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Representante</th><th className="p-2">Visitas/dia</th><th className="p-2">Minutos/visita</th></tr></thead><tbody>{representatives.filter(c => seller === 'all' || c === seller).map(code => <tr key={code} className="border-t"><td className="min-w-[150px] p-2">{nameOf(code)}</td>{(['visitsPerDay','minutesPerVisit'] as const).map(field => <td key={field} className="p-2"><Input className="min-w-[90px]" aria-label={`${field === 'visitsPerDay' ? 'Visitas por dia' : 'Minutos por visita'} ${code}`} type="number" min={0} max={field === 'visitsPerDay' ? 1000 : 1440} value={config.goals[code]?.[field] ?? ''} onChange={e => setDraft({ ...config, goals: { ...config.goals, [code]: { visitsPerDay: config.goals[code]?.visitsPerDay || 0, minutesPerVisit: config.goals[code]?.minutesPerVisit || 0, [field]: Number(e.target.value) } } })} /></td>)}</tr>)}</tbody></table></div><Button disabled={saving || !draft} onClick={save}><Save className="mr-2 h-4 w-4" />{saving ? 'Salvando…' : 'Salvar metas e prazo'}</Button><DataTable rows={goalRows} /></TabsContent>
    </Tabs></>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </div>;
}