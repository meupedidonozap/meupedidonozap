import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Save, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useUpdateStore } from '@/hooks/useStores';
import { DAY_LABELS, emptyBusinessHours, type BusinessHoursConfig, type Shift } from '@/lib/businessHours';
import type { Store } from '@/types';

interface Props { store: Store }

export default function BusinessHoursTab({ store }: Props) {
  const updateStore = useUpdateStore();
  const [config, setConfig] = useState<BusinessHoursConfig>(() =>
    (store.settings as any)?.businessHours || emptyBusinessHours()
  );
  const [newClosedDate, setNewClosedDate] = useState('');

  useEffect(() => {
    setConfig((store.settings as any)?.businessHours || emptyBusinessHours());
  }, [store.id]);

  const setDayClosed = (day: number, closed: boolean) => {
    setConfig(c => ({ ...c, days: { ...c.days, [day]: { ...c.days[String(day)], closed } } }));
  };

  const updateShift = (day: number, idx: number, patch: Partial<Shift>) => {
    setConfig(c => {
      const d = c.days[String(day)] || { closed: false, shifts: [] };
      const shifts = [...(d.shifts || [])];
      shifts[idx] = { ...shifts[idx], ...patch };
      return { ...c, days: { ...c.days, [day]: { ...d, shifts } } };
    });
  };

  const addShift = (day: number) => {
    setConfig(c => {
      const d = c.days[String(day)] || { closed: false, shifts: [] };
      return { ...c, days: { ...c.days, [day]: { ...d, shifts: [...(d.shifts || []), { from: '08:00', to: '12:00' }] } } };
    });
  };

  const removeShift = (day: number, idx: number) => {
    setConfig(c => {
      const d = c.days[String(day)] || { closed: false, shifts: [] };
      return { ...c, days: { ...c.days, [day]: { ...d, shifts: (d.shifts || []).filter((_, i) => i !== idx) } } };
    });
  };

  const addClosedDate = () => {
    if (!newClosedDate) return;
    setConfig(c => ({ ...c, closedDates: Array.from(new Set([...(c.closedDates || []), newClosedDate])).sort() }));
    setNewClosedDate('');
  };

  const removeClosedDate = (d: string) => {
    setConfig(c => ({ ...c, closedDates: (c.closedDates || []).filter(x => x !== d) }));
  };

  const handleSave = async () => {
    try {
      await updateStore.mutateAsync({
        id: store.id,
        settings: { ...store.settings, businessHours: config } as any,
      });
      toast.success('Horários salvos!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Horários de funcionamento</CardTitle>
          <p className="text-sm text-muted-foreground">Defina os turnos de cada dia da semana. Fora desses horários os clientes podem ver a loja mas não conseguem enviar pedidos.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {DAY_LABELS.map((label, day) => {
            const d = config.days[String(day)] || { closed: false, shifts: [] };
            return (
              <div key={day} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">{label}</div>
                  <div className="flex items-center gap-2 text-sm">
                    <Label htmlFor={`closed-${day}`} className="text-muted-foreground">Fechado</Label>
                    <Switch id={`closed-${day}`} checked={!!d.closed} onCheckedChange={(v) => setDayClosed(day, v)} />
                  </div>
                </div>
                {!d.closed && (
                  <div className="mt-2 space-y-2">
                    {(d.shifts || []).map((s, idx) => (
                      <div key={idx} className="flex flex-wrap items-center gap-2">
                        <Input type="time" value={s.from} onChange={(e) => updateShift(day, idx, { from: e.target.value })} className="w-32" />
                        <span className="text-muted-foreground">até</span>
                        <Input type="time" value={s.to} onChange={(e) => updateShift(day, idx, { to: e.target.value })} className="w-32" />
                        <Button size="icon" variant="ghost" onClick={() => removeShift(day, idx)} className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => addShift(day)}>
                      <Plus className="mr-1 h-4 w-4" /> Adicionar turno
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dias fechados (datas específicas)</CardTitle>
          <p className="text-sm text-muted-foreground">Ex.: feriados, recessos. Loja fica fechada o dia inteiro nestas datas.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={newClosedDate} onChange={(e) => setNewClosedDate(e.target.value)} className="w-44" />
            <Button size="sm" variant="outline" onClick={addClosedDate} disabled={!newClosedDate}>
              <Plus className="mr-1 h-4 w-4" /> Adicionar
            </Button>
          </div>
          {(config.closedDates || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma data adicionada.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(config.closedDates || []).map(d => (
                <span key={d} className="inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-sm">
                  {d.split('-').reverse().join('/')}
                  <button onClick={() => removeClosedDate(d)} className="text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateStore.isPending} className="gap-2">
          <Save className="h-4 w-4" /> Salvar horários
        </Button>
      </div>
    </div>
  );
}