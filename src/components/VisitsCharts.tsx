import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { VisitsByDay, VisitsByHour } from '@/hooks/useStoreVisits';

export function VisitsBarChart({ data }: { data: VisitsByDay[] }) {
  const formatted = data.map(d => ({
    ...d,
    label: d.date.slice(5).replace('-', '/'),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="label" className="text-xs fill-muted-foreground" />
        <YAxis allowDecimals={false} className="text-xs fill-muted-foreground" />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))' }}
          labelFormatter={(v) => `Dia ${v}`}
        />
        <Bar dataKey="count" name="Visitas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function VisitsHourChart({ data }: { data: VisitsByHour[] }) {
  const formatted = data.map(d => ({
    ...d,
    label: `${String(d.hour).padStart(2, '0')}h`,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="label" className="text-xs fill-muted-foreground" />
        <YAxis allowDecimals={false} className="text-xs fill-muted-foreground" />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))' }}
          labelFormatter={(v) => `Horário: ${v}`}
        />
        <Bar dataKey="count" name="Visitas" fill="hsl(var(--chart-2, var(--primary)))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
