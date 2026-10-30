export interface DatedValue { date: string | Date; value: number }

export interface PeriodCompare {
  today: number;
  current: { count: number; total: number };
  previous: { count: number; total: number };
  previousSameDays: { count: number; total: number };
  day: number;
  /** % change of current vs previous month up to the same day (null if no base) */
  changeCount: number | null;
  changeTotal: number | null;
  /** cumulative per day 1..daysInMonth(max of both months) */
  series: { day: number; atual: number | null; anterior: number; atualQtd: number | null; anteriorQtd: number }[];
}

const pct = (a: number, b: number) => (b === 0 ? (a === 0 ? 0 : null) : ((a - b) / b) * 100);

function parse(d: string | Date): Date {
  if (d instanceof Date) return d;
  // date-only strings must be read as local days
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd); }
  return new Date(d);
}

/** Compare current month (up to `now`) with previous month, total and same day range. */
export function comparePeriods(rows: DatedValue[], now: Date = new Date()): PeriodCompare {
  const y = now.getFullYear(), m = now.getMonth(), day = now.getDate();
  const py = m === 0 ? y - 1 : y, pm = m === 0 ? 11 : m - 1;
  const daysPrev = new Date(py, pm + 1, 0).getDate();
  const daysCur = new Date(y, m + 1, 0).getDate();
  const curDay = Array.from({ length: 32 }, () => ({ c: 0, t: 0 }));
  const prevDay = Array.from({ length: 32 }, () => ({ c: 0, t: 0 }));
  let todayCount = 0;
  for (const r of rows) {
    const d = parse(r.date);
    if (isNaN(d.getTime())) continue;
    const v = Number(r.value) || 0;
    if (d.getFullYear() === y && d.getMonth() === m && d.getDate() <= day) {
      curDay[d.getDate()].c++; curDay[d.getDate()].t += v;
      if (d.getDate() === day) todayCount++;
    } else if (d.getFullYear() === py && d.getMonth() === pm) {
      prevDay[d.getDate()].c++; prevDay[d.getDate()].t += v;
    }
  }
  const sum = (arr: typeof curDay, upto: number) => arr.slice(1, upto + 1).reduce((a, x) => ({ count: a.count + x.c, total: a.total + x.t }), { count: 0, total: 0 });
  const current = sum(curDay, day);
  const previous = sum(prevDay, daysPrev);
  const previousSameDays = sum(prevDay, Math.min(day, daysPrev));
  const series: PeriodCompare['series'] = [];
  let ac = 0, at = 0, pc = 0, ptot = 0;
  for (let d = 1; d <= Math.max(daysCur, daysPrev); d++) {
    ac += curDay[d].c; at += curDay[d].t; pc += prevDay[d]?.c || 0; ptot += prevDay[d]?.t || 0;
    series.push({ day: d, atual: d <= day ? at : null, atualQtd: d <= day ? ac : null, anterior: ptot, anteriorQtd: pc });
  }
  return {
    today: todayCount, current, previous, previousSameDays, day,
    changeCount: pct(current.count, previousSameDays.count),
    changeTotal: pct(current.total, previousSameDays.total),
    series,
  };
}
