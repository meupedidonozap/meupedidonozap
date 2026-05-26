import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, Link } from 'react-router-dom';
import { format, addMinutes, isSameDay, parseISO, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, MapPin, Phone, ArrowLeft, Clock, CalendarIcon, User as UserIcon } from 'lucide-react';
import { useStoreBySlug } from '@/hooks/useStores';
import { useSalonProfessionals, useSalonAppointments, useCreateAppointment } from '@/hooks/useSalon';
import { useProducts } from '@/hooks/useProducts';
import { useAuth } from '@/hooks/useAuth';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import type { SalonProfessional, Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ClosedBanner from '@/components/ClosedBanner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const DAY_KEYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'] as const;

function getDayHours(workingHours: any, date: Date): { open: string; close: string } | null {
  const key = DAY_KEYS[date.getDay()];
  const day = workingHours?.[key];
  if (!day || !day.isOpen) return null;
  return { open: day.open, close: day.close };
}

function buildSlots(date: Date, openHHmm: string, closeHHmm: string, durationMin: number): Date[] {
  const [oh, om] = openHHmm.split(':').map(Number);
  const [ch, cm] = closeHHmm.split(':').map(Number);
  const start = new Date(date); start.setHours(oh, om, 0, 0);
  const end = new Date(date); end.setHours(ch, cm, 0, 0);
  const slots: Date[] = [];
  let cur = start;
  while (addMinutes(cur, durationMin) <= end) {
    slots.push(cur);
    cur = addMinutes(cur, durationMin);
  }
  return slots;
}

const THEME_PRESETS: Record<string, { primary: string; gradient: string }> = {
  masculino: { primary: '215 50% 23%', gradient: 'linear-gradient(135deg, hsl(215 50% 23%), hsl(40 70% 45%))' },
  feminino:  { primary: '340 75% 55%', gradient: 'linear-gradient(135deg, hsl(330 80% 60%), hsl(350 75% 55%))' },
  neutro:    { primary: '0 0% 12%',    gradient: 'linear-gradient(135deg, hsl(0 0% 12%), hsl(40 60% 50%))' },
};

function getTheme(store: any) {
  const t = store?.settings?.theme;
  if (t?.preset === 'custom' && t.primaryHsl) {
    return { primary: t.primaryHsl, gradient: `linear-gradient(135deg, hsl(${t.primaryHsl}), hsl(${t.accentHsl || t.primaryHsl}))` };
  }
  return THEME_PRESETS[t?.preset || 'masculino'] || THEME_PRESETS.masculino;
}

export default function SalonStorePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: store, isLoading } = useStoreBySlug(slug || '');
  const { data: products = [] } = useProducts(store?.id);
  const { data: professionals = [] } = useSalonProfessionals(store?.id);
  const { user } = useAuth();
  const { data: profile } = useCustomerProfile(user?.id, store?.id);

  const [bookingService, setBookingService] = useState<Product | null>(null);

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (!store) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loja não encontrada</div>;
  }

  const activeServices = products.filter(s => s.isActive).sort((a, b) => a.name.localeCompare(b.name));
  const activeProfessionals = professionals.filter(p => p.isActive);
  const theme = getTheme(store);
  const styleVars = { ['--salon-primary' as any]: theme.primary } as React.CSSProperties;

  return (
    <div className="min-h-screen bg-background" style={styleVars}>
      <Helmet>
        <title>{store.name} — Agendamento</title>
        <meta name="description" content={`Agende seu horário em ${store.name}. ${store.address || ''}`.slice(0, 160)} />
      </Helmet>

      {/* Header */}
      <header className="text-white" style={{ background: theme.gradient }}>
        <div className="container py-6">
          <div className="flex items-center gap-4">
            {store.logo && <img src={store.logo} alt={store.name} className="h-16 w-16 rounded-full bg-white object-contain p-1" />}
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{store.name}</h1>
              {store.address && <p className="text-sm opacity-90 flex items-center gap-1"><MapPin className="h-3 w-3" /> {store.address}</p>}
              {store.phone && <p className="text-sm opacity-90 flex items-center gap-1"><Phone className="h-3 w-3" /> {store.phone}</p>}
            </div>
          </div>
        </div>
      </header>

      <ClosedBanner store={store} />

      <main className="container py-6 space-y-6">
        <section>
          <h2 className="text-xl font-bold mb-4">Nossos serviços</h2>
          {activeServices.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum serviço cadastrado.</CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeServices.map(s => (
                <Card key={s.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  {s.image && <div className="aspect-video bg-white"><img src={s.image} alt={s.name} className="h-full w-full object-contain" /></div>}
                  <CardContent className="p-4 space-y-2">
                    <h3 className="font-semibold">{s.name}</h3>
                    {s.description && <p className="text-sm text-muted-foreground line-clamp-2">{s.description}</p>}
                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <div className="text-lg font-bold" style={{ color: `hsl(${theme.primary})` }}>{formatCurrency(s.basePrice)}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {s.durationMinutes ?? 30} min</div>
                      </div>
                      <Button onClick={() => setBookingService(s)} style={{ background: `hsl(${theme.primary})` }} className="text-white hover:opacity-90">Agendar</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>

      {bookingService && (
        <BookingDialog
          open={!!bookingService}
          onClose={() => setBookingService(null)}
          service={bookingService}
          professionals={activeProfessionals.filter(p => (bookingService.professionalIds || []).includes(p.id))}
          store={store}
          themePrimary={theme.primary}
          defaultName={profile?.name || ''}
          defaultWhatsapp={profile?.whatsapp || ''}
        />
      )}
    </div>
  );
}

function BookingDialog({ open, onClose, service, professionals, store, defaultName, defaultWhatsapp, themePrimary }: {
  open: boolean;
  onClose: () => void;
  service: Product;
  professionals: SalonProfessional[];
  store: any;
  defaultName: string;
  defaultWhatsapp: string;
  themePrimary: string;
}) {
  const durationMin = service.durationMinutes ?? 30;
  const [professionalId, setProfessionalId] = useState<string>(professionals[0]?.id || '');
  const [date, setDate] = useState<Date | undefined>();
  const [slot, setSlot] = useState<Date | null>(null);
  const [name, setName] = useState(defaultName);
  const [whatsapp, setWhatsapp] = useState(defaultWhatsapp);
  const [submitting, setSubmitting] = useState(false);

  const fromIso = date ? startOfDay(date).toISOString() : undefined;
  const toIso = date ? endOfDay(date).toISOString() : undefined;
  const { data: dayAppointments = [] } = useSalonAppointments(date && professionalId ? store.id : undefined, fromIso, toIso);
  const createAppointment = useCreateAppointment();

  const dayHours = useMemo(() => date ? getDayHours(store.settings?.workingHours, date) : null, [date, store]);

  const slots = useMemo(() => {
    if (!date || !dayHours) return [];
    return buildSlots(date, dayHours.open, dayHours.close, durationMin);
  }, [date, dayHours, durationMin]);

  const isSlotTaken = (s: Date) => {
    const slotEnd = addMinutes(s, durationMin);
    return dayAppointments.some(a => {
      if (a.professionalId !== professionalId) return false;
      if (a.status === 'cancelado') return false;
      const aStart = parseISO(a.startsAt);
      const aEnd = parseISO(a.endsAt);
      return aStart < slotEnd && aEnd > s;
    });
  };

  const isSlotPast = (s: Date) => s.getTime() <= Date.now();

  const handleConfirm = async () => {
    if (!professionalId) { toast.error('Escolha um profissional'); return; }
    if (!slot) { toast.error('Escolha um horário'); return; }
    if (!name.trim()) { toast.error('Informe seu nome'); return; }
    if (!whatsapp.trim()) { toast.error('Informe seu WhatsApp'); return; }
    setSubmitting(true);
    try {
      const startsAt = slot.toISOString();
      const endsAt = addMinutes(slot, durationMin).toISOString();
      await createAppointment.mutateAsync({
        storeId: store.id,
        professionalId,
        serviceId: service.id,
        customerName: name.trim(),
        customerWhatsapp: whatsapp.trim(),
        startsAt,
        endsAt,
      });
      const prof = professionals.find(p => p.id === professionalId);
      const dateStr = format(slot, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      const msg = `*Novo agendamento*%0A%0A*Cliente:* ${encodeURIComponent(name)}%0A*WhatsApp:* ${encodeURIComponent(whatsapp)}%0A*Serviço:* ${encodeURIComponent(service.name)}%0A*Profissional:* ${encodeURIComponent(prof?.name || '')}%0A*Data:* ${encodeURIComponent(dateStr)}%0A*Duração:* ${durationMin} min%0A*Valor:* ${encodeURIComponent(formatCurrency(service.basePrice))}`;
      const wa = (store.whatsapp || '').replace(/\D/g, '');
      toast.success('Agendamento reservado!');
      onClose();
      if (wa) window.open(`https://wa.me/${wa}?text=${msg}`, '_blank');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao agendar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendar — {service.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Profissional</Label>
            {professionals.length === 0 ? (
              <p className="text-sm text-destructive mt-1">Nenhum profissional disponível para este serviço.</p>
            ) : (
              <Select value={professionalId} onValueChange={(v) => { setProfessionalId(v); setSlot(null); }}>
                <SelectTrigger><SelectValue placeholder="Escolha um profissional" /></SelectTrigger>
                <SelectContent>
                  {professionals.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <Label>Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP", { locale: ptBR }) : 'Escolha uma data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => { setDate(d); setSlot(null); }}
                  disabled={(d) => {
                    if (d < startOfDay(new Date())) return true;
                    return !getDayHours(store.settings?.workingHours, d);
                  }}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
            {date && !dayHours && <p className="text-sm text-destructive mt-1">Salão fechado neste dia.</p>}
          </div>

          {date && dayHours && (
            <div>
              <Label>Horários disponíveis</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {slots.length === 0 && <p className="col-span-3 text-sm text-muted-foreground">Sem horários disponíveis.</p>}
                {slots.map(s => {
                  const taken = isSlotTaken(s) || isSlotPast(s);
                  const selected = slot && slot.getTime() === s.getTime();
                  return (
                    <Button
                      key={s.toISOString()}
                      type="button"
                      variant={selected ? 'default' : 'outline'}
                      disabled={taken}
                      onClick={() => setSlot(s)}
                      style={selected ? { background: `hsl(${themePrimary})` } : undefined}
                      className={cn(selected && 'text-white hover:opacity-90')}
                    >
                      {format(s, 'HH:mm')}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid gap-3">
            <div>
              <Label htmlFor="cust-name">Seu nome</Label>
              <Input id="cust-name" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="cust-wa">WhatsApp</Label>
              <Input id="cust-wa" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
          </div>

          <div className="rounded-md bg-muted p-3 text-sm">
            <div className="flex justify-between"><span>Serviço:</span><span className="font-medium">{service.name}</span></div>
            <div className="flex justify-between"><span>Duração:</span><span className="font-medium">{durationMin} min</span></div>
            <div className="flex justify-between"><span>Valor:</span><span className="font-bold" style={{ color: `hsl(${themePrimary})` }}>{formatCurrency(service.basePrice)}</span></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={submitting || !slot} style={{ background: `hsl(${themePrimary})` }} className="text-white hover:opacity-90">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar agendamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}