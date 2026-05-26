export interface Shift { from: string; to: string }
export interface DayHours { closed: boolean; shifts: Shift[] }
export interface BusinessHoursConfig {
  days: Record<string, DayHours>;          // '0'..'6' (0 = domingo)
  closedDates?: string[];                  // 'YYYY-MM-DD'
}

const DAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function pad(n: number) { return n.toString().padStart(2, '0'); }
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function getBusinessHours(settings: any): BusinessHoursConfig | null {
  const bh = settings?.businessHours;
  if (!bh || typeof bh !== 'object' || !bh.days) return null;
  return bh as BusinessHoursConfig;
}

export interface StoreOpenStatus {
  open: boolean;
  message?: string;       // mensagem amigável (ex.: "Abre hoje às 17:00")
  nextOpenAt?: Date;
}

export function isStoreOpen(settings: any, now: Date = new Date()): StoreOpenStatus {
  const bh = getBusinessHours(settings);
  if (!bh) return { open: true };

  const todayKey = dateKey(now);
  const closedDates = bh.closedDates || [];
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const dow = now.getDay();

  const todayConfig = bh.days[String(dow)];
  const todayClosedByDate = closedDates.includes(todayKey);

  if (!todayClosedByDate && todayConfig && !todayConfig.closed) {
    for (const shift of todayConfig.shifts || []) {
      const from = toMinutes(shift.from);
      const to = toMinutes(shift.to);
      if (minutesNow >= from && minutesNow < to) {
        return { open: true };
      }
    }
  }

  // Próximo horário de abertura (procura até 14 dias)
  for (let i = 0; i < 14; i++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + i);
    const cKey = dateKey(candidate);
    if (closedDates.includes(cKey)) continue;
    const cfg = bh.days[String(candidate.getDay())];
    if (!cfg || cfg.closed || !cfg.shifts?.length) continue;
    const sorted = [...cfg.shifts].sort((a, b) => toMinutes(a.from) - toMinutes(b.from));
    for (const s of sorted) {
      const startMin = toMinutes(s.from);
      if (i === 0 && startMin <= minutesNow) continue;
      const next = new Date(candidate);
      next.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
      const label = i === 0
        ? `Abre hoje às ${s.from}`
        : i === 1
          ? `Abre amanhã às ${s.from}`
          : `Abre ${DAY_NAMES[candidate.getDay()]} ${pad(candidate.getDate())}/${pad(candidate.getMonth() + 1)} às ${s.from}`;
      return { open: false, message: label, nextOpenAt: next };
    }
  }

  return { open: false, message: 'Loja fechada' };
}

export function emptyBusinessHours(): BusinessHoursConfig {
  const days: Record<string, DayHours> = {};
  for (let i = 0; i < 7; i++) days[String(i)] = { closed: i === 0, shifts: i === 0 ? [] : [{ from: '08:00', to: '18:00' }] };
  return { days, closedDates: [] };
}

export const DAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];