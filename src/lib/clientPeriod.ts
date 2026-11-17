export const DEFAULT_CLIENT_PERIOD = '60d';
export function clientPeriodBounds(period: string, today: string) {
  const date = new Date(today + 'T12:00:00Z');
  const year = date.getUTCFullYear(), month = date.getUTCMonth();
  const iso = (value: Date) => value.toISOString().slice(0, 10);
  if (period === 'month') return { from: iso(new Date(Date.UTC(year, month, 1))), to: today };
  if (period === 'last') return { from: iso(new Date(Date.UTC(year, month - 1, 1))), to: iso(new Date(Date.UTC(year, month, 0))) };
  if (period === 'year') return { from: `${year}-01-01`, to: today };
  const days = Number(period.replace('d', '')) || 60;
  return { from: iso(new Date(date.getTime() - (days - 1) * 86400000)), to: today };
}