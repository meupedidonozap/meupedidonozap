/** Inteligência comercial de clientes (DiColore): frequência, ticket, ABC, recuperação, cidades, mix e metas. */
export const normCode = (c: unknown) => String(c ?? '').trim().replace(/^0+(?=\d)/, '');

export interface CA_Customer { code: string; name: string; city: string; uf: string; seller: string; active: boolean }
export interface CA_Invoice { customer: string; seller: string; date: string; value: number }
export interface CA_InvoiceSummary { code: string; history_revenue: number; history_orders: number; orders: number; revenue: number; prev_orders: number; prev_revenue: number; first_purchase: string | null; last_purchase: string | null; purchase_days: number; }
export interface CA_Mix { customer: string; category: string; value: number; period: 'cur' | 'prev' }
export interface CA_Range { from: string; to: string }
export type Frequency = 'Semanal' | 'Quinzenal' | 'Mensal' | 'Bimestral' | 'Trimestral' | 'Esporádico' | 'Compra única' | 'Sem compras';
export type Status = 'Ativo' | 'Em risco' | 'Inativo' | 'Nunca comprou' | 'Sem compras no intervalo';
export type Abc = 'A' | 'B' | 'C' | '-';

export interface CustomerRow {
  code: string; name: string; city: string; uf: string; seller: string;
  revenue: number; prevRevenue: number; orders: number; prevOrders: number; ticket: number; prevTicket: number;
  historyRevenue: number; historyOrders: number; avgInterval: number | null; frequency: Frequency;
  lastPurchase: string | null; daysSince: number | null; trend: number | null; status: Status; abc: Abc;
  lines: string[]; missingLines: string[]; opportunities: string[]; recovery: number;
}

const DAY = 86400000;
const toDay = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Período anterior com o mesmo número de dias, imediatamente antes. */
export function previousRange(r: CA_Range): CA_Range {
  const days = Math.round((toDay(r.to) - toDay(r.from)) / DAY) + 1;
  const to = toDay(r.from) - DAY;
  return { from: iso(to - (days - 1) * DAY), to: iso(to) };
}

export function frequencyOf(avg: number | null, orders: number): Frequency {
  if (orders === 0) return 'Sem compras';
  if (avg === null) return 'Compra única';
  if (avg <= 10) return 'Semanal';
  if (avg <= 20) return 'Quinzenal';
  if (avg <= 40) return 'Mensal';
  if (avg <= 70) return 'Bimestral';
  if (avg <= 100) return 'Trimestral';
  return 'Esporádico';
}

/** Classificação ABC: A até 80% acumulado, B até 95%, C restante; sem faturamento = '-'. */
export function abcClasses<T>(items: T[], value: (t: T) => number): Map<T, Abc> {
  const sorted = items.filter(i => value(i) > 0).sort((a, b) => value(b) - value(a));
  const total = sorted.reduce((s, i) => s + value(i), 0);
  const out = new Map<T, Abc>(items.map(i => [i, '-' as Abc]));
  let acc = 0;
  for (const i of sorted) {
    const before = acc / total; acc += value(i);
    out.set(i, before < 0.8 ? 'A' : before < 0.95 ? 'B' : 'C');
  }
  return out;
}

export const pct = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

export interface AnalyticsInput {
  customers: CA_Customer[]; invoices: CA_Invoice[]; mix: CA_Mix[]; range: CA_Range; today: string;
  invoiceSummaries?: CA_InvoiceSummary[];
  boundedHistory?: boolean;
  riskDays?: number; inactiveDays?: number; lineMap?: Record<string, string>;
  /** Agrupamento da curva ABC */
  abcBy?: 'seller' | 'city' | 'all';
}

export function analyzeClients(inp: AnalyticsInput) {
  const riskDays = inp.riskDays ?? 60, inactiveDays = inp.inactiveDays ?? 120;
  const prev = previousRange(inp.range);
  const line = (c: string) => inp.lineMap?.[c] || c;
  const byCode = new Map<string, CA_Customer>();
  for (const c of inp.customers) { const k = normCode(c.code); if (k && (!byCode.has(k) || c.active)) byCode.set(k, c); }
  const inv = new Map<string, CA_Invoice[]>();
  for (const i of inp.invoices) { const k = normCode(i.customer); if (!byCode.has(k) || !i.date) continue; const list = inv.get(k) || []; list.push(i); inv.set(k, list); }
  const summaries = new Map(inp.invoiceSummaries?.map(s => [normCode(s.code), s]));
  const lineSets = new Map<string, { cur: Map<string, number>; prev: Map<string, number> }>();
  for (const m of inp.mix) {
    const k = normCode(m.customer); if (!byCode.has(k)) continue;
    const s = lineSets.get(k) || { cur: new Map<string, number>(), prev: new Map<string, number>() }; lineSets.set(k, s);
    const t = s[m.period]; t.set(line(m.category), (t.get(line(m.category)) || 0) + m.value);
  }
  const lineTotals = new Map<string, number>();
  for (const s of lineSets.values()) for (const [l, v] of s.cur) lineTotals.set(l, (lineTotals.get(l) || 0) + v);
  const coreLines = [...lineTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(e => e[0]);

  const rows: CustomerRow[] = [];
  for (const [code, c] of byCode) {
    const summary = summaries.get(code);
    if (!c.active && !inv.has(code) && !summary) continue;
    const list = (inv.get(code) || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const inR = (i: CA_Invoice, r: CA_Range) => i.date >= r.from && i.date <= r.to;
    const cur = list.filter(i => inR(i, inp.range)), pr = list.filter(i => inR(i, prev));
    const sum = (l: CA_Invoice[]) => l.reduce((s, i) => s + i.value, 0);
    const days = [...new Set(list.filter(i => i.date <= inp.range.to).map(i => i.date))];
    const purchaseDays = summary ? Number(summary.purchase_days) : days.length;
    const first = summary ? summary.first_purchase : days[0];
    const last = summary ? summary.last_purchase : days[days.length - 1] || null;
    const avgInterval = purchaseDays > 1 && first && last ? Math.round((toDay(last) - toDay(first)) / DAY / (purchaseDays - 1)) : null;
    const daysSince = last ? Math.round((toDay(inp.today) - toDay(last)) / DAY) : null;
    const revenue = summary ? Number(summary.revenue) : sum(cur), prevRevenue = summary ? Number(summary.prev_revenue) : sum(pr);
    const orderCount = summary ? Number(summary.orders) : cur.length, prevOrderCount = summary ? Number(summary.prev_orders) : pr.length;
    const status: Status = daysSince === null ? (inp.boundedHistory ? 'Sem compras no intervalo' : 'Nunca comprou') : daysSince > inactiveDays ? 'Inativo' : daysSince > riskDays ? 'Em risco' : 'Ativo';
    const ls = lineSets.get(code);
    const lines = ls ? [...ls.cur.keys()].sort() : [];
    const missingLines = lines.length ? coreLines.filter(l => !ls?.cur.has(l)) : [];
    const ticket = orderCount ? revenue / orderCount : 0, prevTicket = prevOrderCount ? prevRevenue / prevOrderCount : 0;
    rows.push({
      code, name: c.name, city: c.city, uf: c.uf, seller: normCode(c.seller), revenue, prevRevenue,
      orders: orderCount, prevOrders: prevOrderCount, ticket, prevTicket, historyRevenue: summary ? Number(summary.history_revenue) : sum(list), historyOrders: summary ? Number(summary.history_orders) : list.length,
      avgInterval, frequency: frequencyOf(avgInterval, purchaseDays), lastPurchase: last, daysSince,
      trend: pct(revenue, prevRevenue), status, abc: '-', lines, missingLines, opportunities: [],
      recovery: Math.max(0, prevRevenue - revenue),
    });
  }
  // ABC por grupo
  const groups = new Map<string, CustomerRow[]>();
  for (const r of rows) { const g = inp.abcBy === 'city' ? `${r.city}/${r.uf}` : inp.abcBy === 'all' ? '*' : r.seller; const list = groups.get(g) || []; list.push(r); groups.set(g, list); }
  for (const list of groups.values()) { const m = abcClasses(list, r => r.revenue); for (const r of list) r.abc = m.get(r) || '-'; }
  // Oportunidades
  const tickets = rows.filter(r => r.orders > 0).map(r => r.ticket).sort((a, b) => a - b);
  const medianTicket = tickets.length ? tickets[Math.floor(tickets.length / 2)] : 0;
  for (const r of rows) {
    const o = r.opportunities;
    if (r.prevRevenue > 0 && r.revenue === 0) o.push('Parou de comprar');
    else if (r.trend !== null && r.trend <= -20) o.push('Reduziu compras');
    if (r.prevOrders > 0 && r.orders < r.prevOrders) o.push('Menor frequência');
    if (r.orders >= 2 && r.ticket < medianTicket * 0.6) o.push('Frequente com ticket baixo');
    if (r.lines.length > 0 && r.missingLines.length >= 3) o.push('Mix reduzido');
    if (r.status === 'Inativo' && r.historyRevenue > 0) o.push('Longo tempo sem pedido');
    if (r.abc === 'C' && r.frequency !== 'Esporádico' && r.orders >= 2) o.push('Potencial de crescimento');
  }
  return { rows, prev, coreLines, medianTicket };
}

export interface GroupStat { key: string; customers: number; buyers: number; positivation: number; revenue: number; prevRevenue: number; trend: number | null; share: number; ticket: number; orders: number }

export function groupStats(rows: CustomerRow[], key: (r: CustomerRow) => string): GroupStat[] {
  const m = new Map<string, GroupStat>();
  const total = rows.reduce((s, r) => s + r.revenue, 0);
  for (const r of rows) {
    const k = key(r) || '(sem)';
    const g = m.get(k) || m.set(k, { key: k, customers: 0, buyers: 0, positivation: 0, revenue: 0, prevRevenue: 0, trend: null, share: 0, ticket: 0, orders: 0 }).get(k)!;
    g.customers++; if (r.orders > 0) g.buyers++; g.revenue += r.revenue; g.prevRevenue += r.prevRevenue; g.orders += r.orders;
  }
  for (const g of m.values()) {
    g.positivation = g.customers ? (g.buyers / g.customers) * 100 : 0;
    g.trend = pct(g.revenue, g.prevRevenue); g.share = total ? (g.revenue / total) * 100 : 0; g.ticket = g.orders ? g.revenue / g.orders : 0;
  }
  return [...m.values()].sort((a, b) => b.revenue - a.revenue);
}

/** Concentração: quantos clientes somam 80% e participação dos 5 maiores. */
export function concentration(rows: CustomerRow[]) {
  const s = rows.filter(r => r.revenue > 0).sort((a, b) => b.revenue - a.revenue);
  const total = s.reduce((a, r) => a + r.revenue, 0);
  let acc = 0, n80 = 0;
  for (const r of s) { if (acc / total >= 0.8) break; acc += r.revenue; n80++; }
  const top5 = s.slice(0, 5).reduce((a, r) => a + r.revenue, 0);
  return { buyers: s.length, n80, pct80: s.length ? (n80 / s.length) * 100 : 0, top5Share: total ? (top5 / total) * 100 : 0, total };
}

export interface GoalRow { seller: string; revenue: number; buyers: number; goalRevenue: number; goalBuyers: number; revenuePct: number | null; buyersPct: number | null }
export function goalProgress(rows: CustomerRow[], goals: Record<string, { revenue?: number; buyers?: number }>): GoalRow[] {
  const stats = groupStats(rows, r => r.seller);
  const keys = new Set([...stats.map(s => s.key), ...Object.keys(goals).map(normCode)]);
  return [...keys].map(k => {
    const s = stats.find(x => x.key === k);
    const g = goals[k] || Object.entries(goals).find(([c]) => normCode(c) === k)?.[1] || {};
    const gr = Number(g.revenue || 0), gb = Number(g.buyers || 0);
    const revenue = s?.revenue || 0, buyers = s?.buyers || 0;
    return { seller: k, revenue, buyers, goalRevenue: gr, goalBuyers: gb, revenuePct: gr ? (revenue / gr) * 100 : null, buyersPct: gb ? (buyers / gb) * 100 : null };
  }).sort((a, b) => b.revenue - a.revenue);
}
