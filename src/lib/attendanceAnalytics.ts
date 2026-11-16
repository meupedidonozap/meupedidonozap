export const codeKey = (value?: string | null) => (value || '').trim().replace(/^0+(?=\d)/, '');
export const dayKey = (value: string) => value.length === 10 ? value : new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
export function daysBetween(a: string, b: string) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000); }
export function periodBounds(period: string, today: string) {
  const [year, month] = today.split('-').map(Number);
  if (period === 'today') return { from: today, to: today };
  if (period === 'month') return { from: `${today.slice(0, 7)}-01`, to: today };
  if (period === 'previous') {
    const last = new Date(Date.UTC(year, month - 1, 0)).toISOString().slice(0, 10);
    return { from: last.slice(0, 7) + '-01', to: last };
  }
  return { from: new Date(Date.parse(today + 'T12:00:00Z') - 89 * 86400000).toISOString().slice(0, 10), to: today };
}
export function calendarDays(from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return [];
  const size = daysBetween(from, to) + 1;
  return Array.from({ length: Math.max(0, Math.min(size, 3660)) }, (_, i) => new Date(Date.parse(from + 'T12:00:00Z') + i * 86400000).toISOString().slice(0, 10));
}
export const businessDays = (from: string, to: string) => calendarDays(from, to).filter(d => ![0, 6].includes(new Date(d + 'T12:00:00Z').getUTCDay())).length;
export const durationLabel = (seconds: number | null | undefined) => seconds == null ? '—' : [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), Math.floor(seconds % 60)].map(x => String(x).padStart(2, '0')).join(':');
export const validPurchase = (status: string) => !['101', 'cancelado', 'cancelada', 'canceled', 'cancelled', 'orcamento'].includes(status.toLowerCase());
export interface AttendanceClient { id: string; name: string; nome_fantasia: string | null; customer_code: string; seller_code: string; city: string; uf: string; data_ultima_compra: string | null; }
export interface AttendanceVisit { id: string; seller_user_id: string; seller_code: string | null; customer_profile_id: string; checked_in_at: string; checked_out_at: string | null; duration_seconds: number | null; checkout_reason: string | null; checkout_notes: string | null; distance_meters_at_checkin: number | null; out_of_range_reason: string | null; }
export interface AttendancePurchase { cliente_codigo: string; data_emissao: string | null; status: string; valor_total_nota_fiscal?: number; }
export interface AttendanceGoal { visitsPerDay: number; minutesPerVisit: number; }
export interface AttendanceSettings { staleDays: number; goals: Record<string, AttendanceGoal>; }
export function validSettings(settings: AttendanceSettings) {
  return Number.isInteger(settings.staleDays) && settings.staleDays >= 1 && settings.staleDays <= 3650 && Object.entries(settings.goals).every(([code, goal]) => /^\d+$/.test(code) && Number.isInteger(goal.visitsPerDay) && goal.visitsPerDay >= 0 && goal.visitsPerDay <= 1000 && Number.isFinite(goal.minutesPerVisit) && goal.minutesPerVisit >= 0 && goal.minutesPerVisit <= 1440);
}
export function attendanceReport(clients: AttendanceClient[], visits: AttendanceVisit[], purchases: AttendancePurchase[], from: string, to: string, seller: string, staleDays: number) {
  const clientIdentity = (id: string, code: string) => codeKey(code) ? `erp:${codeKey(code)}` : `mpz:${id}`;
  const identities = new Map(clients.map(c => [c.id, clientIdentity(c.id, c.customer_code)]));
  const identityOfVisit = (v: AttendanceVisit) => identities.get(v.customer_profile_id) || `mpz:${v.customer_profile_id}`;
  const matching = visits.filter(v => seller === 'all' || codeKey(v.seller_code) === codeKey(seller));
  const rows = matching.filter(v => dayKey(v.checked_in_at) >= from && dayKey(v.checked_in_at) <= to);
  const history = new Map<string, string>();
  // Last visit is independent of the current portfolio representative; transfers retain history.
  visits.forEach(v => { const day = dayKey(v.checked_in_at); const key = identityOfVisit(v); if (day <= to && day > (history.get(key) || '')) history.set(key, day); });
  const firstVisit = new Map<string, string>();
  rows.forEach(v => { const key = identityOfVisit(v), day = dayKey(v.checked_in_at); if (day < (firstVisit.get(key) || '9999')) firstVisit.set(key, day); });
  const bought = new Set<string>();
  const lifetime = new Map<string, number>();
  purchases.filter(p => p.data_emissao && validPurchase(p.status)).forEach(p => {
    const key = `erp:${codeKey(p.cliente_codigo)}`, day = p.data_emissao || '';
    if (day <= to) lifetime.set(key, (lifetime.get(key) || 0) + Number(p.valor_total_nota_fiscal || 0));
    if (day >= from && day <= to && day >= (firstVisit.get(key) || '9999')) bought.add(key);
  });
  const seen = new Set<string>();
  const coverage = clients.filter(c => seller === 'all' || codeKey(c.seller_code) === codeKey(seller)).filter(c => {
    const key = clientIdentity(c.id, c.customer_code); if (seen.has(key)) return false; seen.add(key); return true;
  }).map(c => {
    const key = clientIdentity(c.id, c.customer_code), last = history.get(key) || null;
    const visited = firstVisit.has(key);
    return { ...c, last, days: last ? daysBetween(last, to) : null, visited, bought: bought.has(key), revenue: lifetime.get(key) || 0, stale: !last || daysBetween(last, to) > staleDays };
  });
  const closed = rows.filter(v => v.checked_out_at && v.duration_seconds != null);
  const averageSeconds = closed.length ? closed.reduce((sum, v) => sum + Number(v.duration_seconds), 0) / closed.length : 0;
  const daily = calendarDays(from, to).map(day => {
    const list = rows.filter(v => dayKey(v.checked_in_at) === day);
    const complete = list.filter(v => v.checked_out_at && v.duration_seconds != null);
    return { day, visits: list.length, minutes: complete.length ? complete.reduce((a, v) => a + Number(v.duration_seconds), 0) / complete.length / 60 : 0 };
  });
  const reasons = new Map<string, number>();
  rows.forEach(v => { const key = v.checkout_reason || (v.checked_out_at ? 'Não informado' : 'Em andamento'); reasons.set(key, (reasons.get(key) || 0) + 1); });
  const regions = new Map<string, { city: string; clients: number; visited: number }>();
  coverage.forEach(c => { const city = `${c.city || 'Não informada'}/${c.uf || '—'}`, item = regions.get(city) || { city, clients: 0, visited: 0 }; item.clients++; if (c.visited) item.visited++; regions.set(city, item); });
  return { rows, coverage, daily, reasons: [...reasons].map(([reason, count]) => ({ reason, count })), regions: [...regions.values()], averageSeconds, visited: firstVisit.size, bought: bought.size, withoutPurchase: firstVisit.size - bought.size, workdays: businessDays(from, to) };
}