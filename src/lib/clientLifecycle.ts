import { normCode, type CA_Customer, type CA_Range } from './clientAnalytics';

export interface PurchaseDay { date: string; revenue: number; invoices: number }
export interface LifecycleSummary { from: string; to: string; clients: { code: string; days: PurchaseDay[] }[] }
export const lifecycleStages = ['Recorrente', 'Desacelerando', 'Em risco', 'Inativo crítico', 'Reativado', 'Primeira compra observada', 'Compra única', 'Sem compras no histórico disponível'] as const;
export type LifecycleStage = typeof lifecycleStages[number];
const day = (s: string) => Date.parse(`${s}T00:00:00Z`);
const gap = (a: string, b: string) => Math.round((day(b) - day(a)) / 86400000);
const mean = (v: number[]) => v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;

export function lifecycleRows(customers: CA_Customer[], summary: LifecycleSummary, range: CA_Range) {
  const byCode = new Map(summary.clients.map(c => [normCode(c.code), c.days]));
  const unique = new Map<string, CA_Customer>();
  for (const c of customers) { const key = normCode(c.code); if (key && (!unique.has(key) || c.active)) unique.set(key, c); }
  return [...unique].map(([code, c]) => {
    const days = (byCode.get(code) || []).filter(d => d.date >= summary.from && d.date <= range.to).slice().sort((a, b) => a.date.localeCompare(b.date));
    const intervals = days.slice(1).map((d, i) => gap(days[i].date, d.date));
    // Compare non-overlapping intervals; require at least two older intervals.
    const recentCount = Math.min(3, Math.max(1, intervals.length - 2));
    const recent = mean(intervals.slice(-recentCount));
    const historical = intervals.length >= 3 ? mean(intervals.slice(0, -recentCount)) : null;
    const slowing = historical !== null && recent !== null && recent >= historical * 1.5;
    const last = days.at(-1)?.date ?? null, first = days[0]?.date ?? null;
    const daysSince = last ? gap(last, range.to) : null;
    const returned = days.some((d, i) => i > 0 && d.date >= range.from && gap(days[i - 1].date, d.date) > 90);
    const newObserved = first !== null && first >= range.from;
    const current = days.filter(d => d.date >= range.from);
    const overdue = recent !== null && daysSince !== null && daysSince > recent * 1.5;
    let stage: LifecycleStage = 'Sem compras no histórico disponível';
    if (daysSince !== null) {
      if (daysSince >= 180) stage = 'Inativo crítico';
      else if (daysSince > 90) stage = 'Em risco';
      else if (returned) stage = 'Reativado';
      else if (newObserved) stage = 'Primeira compra observada';
      else if (slowing || overdue) stage = 'Desacelerando';
      else if (days.length === 1) stage = 'Compra única';
      else stage = 'Recorrente';
    }
    const revenue = current.reduce((s, d) => s + Number(d.revenue), 0);
    const invoices = current.reduce((s, d) => s + Number(d.invoices), 0);
    return { ...c, code, seller: normCode(c.seller), days, stage, historical, recent, slowing, returned, newObserved, first, last, daysSince, revenue, invoices, ticket: invoices ? revenue / invoices : 0 };
  });
}