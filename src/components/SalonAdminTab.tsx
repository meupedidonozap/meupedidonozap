import { useState, useMemo } from 'react';
import { format, addDays, addMinutes, parseISO, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Edit2, Trash2, Loader2, CalendarIcon, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useSalonProfessionals, useUpsertProfessional, useDeleteProfessional, useSalonAppointments, useCreateAppointment, useUpdateAppointmentStatus, useDeleteAppointment } from '@/hooks/useSalon';
import { useProducts } from '@/hooks/useProducts';
import type { SalonProfessional, SalonAppointment, SalonAppointmentStatus, Product } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const statusColors: Record<SalonAppointmentStatus, string> = {
  reservado: 'bg-yellow-100 text-yellow-800',
  confirmado: 'bg-blue-100 text-blue-800',
  concluido: 'bg-green-100 text-green-800',
  cancelado: 'bg-red-100 text-red-800',
};

export default function SalonAdminTab({ storeId }: { storeId: string }) {
  return (
    <Tabs defaultValue="agenda" className="w-full">
      <TabsList>
        <TabsTrigger value="agenda">Agenda</TabsTrigger>
        <TabsTrigger value="professionals">Profissionais</TabsTrigger>
      </TabsList>
      <TabsContent value="agenda" className="mt-4">
        <AgendaTab storeId={storeId} />
      </TabsContent>
      <TabsContent value="professionals" className="mt-4">
        <ProfessionalsTab storeId={storeId} />
      </TabsContent>
    </Tabs>
  );
}

// ==== PROFESSIONALS ====
function ProfessionalsTab({ storeId }: { storeId: string }) {
  const { data: pros = [], isLoading } = useSalonProfessionals(storeId);
  const upsert = useUpsertProfessional();
  const del = useDeleteProfessional();
  const [editing, setEditing] = useState<SalonProfessional | null>(null);
  const [open, setOpen] = useState(false);

  const onNew = () => { setEditing(null); setOpen(true); };
  const onEdit = (p: SalonProfessional) => { setEditing(p); setOpen(true); };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Profissionais</h3>
        <Button onClick={onNew}><Plus className="h-4 w-4 mr-2" /> Novo profissional</Button>
      </div>
      {isLoading ? <Loader2 className="animate-spin" /> : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {pros.map(p => (
            <Card key={p.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    {p.bio && <p className="text-sm text-muted-foreground">{p.bio}</p>}
                    <Badge variant={p.isActive ? 'default' : 'secondary'} className="mt-2">{p.isActive ? 'Ativo' : 'Inativo'}</Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => onEdit(p)}><Edit2 className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm('Excluir este profissional?')) del.mutate({ id: p.id, storeId }); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {pros.length === 0 && <p className="text-muted-foreground">Nenhum profissional cadastrado.</p>}
        </div>
      )}
      <ProfessionalDialog open={open} onClose={() => setOpen(false)} editing={editing} storeId={storeId} onSave={(payload) => upsert.mutateAsync(payload).then(() => setOpen(false))} />
    </div>
  );
}

function ProfessionalDialog({ open, onClose, editing, storeId, onSave }: any) {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isActive, setIsActive] = useState(true);

  useMemo(() => {
    if (open) {
      setName(editing?.name || '');
      setBio(editing?.bio || '');
      setPhotoUrl(editing?.photoUrl || '');
      setIsActive(editing?.isActive ?? true);
    }
  }, [open, editing]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? 'Editar profissional' : 'Novo profissional'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome *</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Bio</Label><Textarea value={bio} onChange={e => setBio(e.target.value)} /></div>
          <div><Label>URL da foto</Label><Input value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} /></div>
          <div className="flex items-center gap-2"><Switch checked={isActive} onCheckedChange={setIsActive} /><Label>Ativo</Label></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => {
            if (!name.trim()) { toast.error('Nome obrigatório'); return; }
            onSave({ id: editing?.id, storeId, name: name.trim(), bio, photoUrl, isActive });
          }}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==== SERVICES ====
function ServicesTab({ storeId }: { storeId: string }) {
  const { data: services = [], isLoading } = useSalonServices(storeId);
  const { data: pros = [] } = useSalonProfessionals(storeId);
  const upsert = useUpsertService();
  const del = useDeleteService();
  const [editing, setEditing] = useState<SalonService | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Serviços</h3>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-2" /> Novo serviço</Button>
      </div>
      {isLoading ? <Loader2 className="animate-spin" /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {services.map(s => (
            <Card key={s.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-semibold">{s.name}</div>
                    {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
                    <div className="flex gap-2 mt-2 flex-wrap text-sm">
                      <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> {s.durationMinutes} min</Badge>
                      <Badge variant="outline">{formatCurrency(s.price)}</Badge>
                      <Badge variant={s.isActive ? 'default' : 'secondary'}>{s.isActive ? 'Ativo' : 'Inativo'}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Profissionais: {s.professionalIds.map(id => pros.find(p => p.id === id)?.name).filter(Boolean).join(', ') || 'Nenhum'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(s); setOpen(true); }}><Edit2 className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm('Excluir este serviço?')) del.mutate({ id: s.id, storeId }); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {services.length === 0 && <p className="text-muted-foreground">Nenhum serviço cadastrado.</p>}
        </div>
      )}
      <ServiceDialog open={open} onClose={() => setOpen(false)} editing={editing} storeId={storeId} professionals={pros} onSave={(p) => upsert.mutateAsync(p).then(() => setOpen(false))} />
    </div>
  );
}

function ServiceDialog({ open, onClose, editing, storeId, professionals, onSave }: any) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0');
  const [durationMinutes, setDuration] = useState('30');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [professionalIds, setProfessionalIds] = useState<string[]>([]);

  useMemo(() => {
    if (open) {
      setName(editing?.name || '');
      setDescription(editing?.description || '');
      setPrice(String(editing?.price ?? 0));
      setDuration(String(editing?.durationMinutes ?? 30));
      setImageUrl(editing?.imageUrl || '');
      setIsActive(editing?.isActive ?? true);
      setProfessionalIds(editing?.professionalIds || []);
    }
  }, [open, editing]);

  const toggle = (id: string) => setProfessionalIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? 'Editar serviço' : 'Novo serviço'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome *</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Descrição</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Preço (R$)</Label><Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} /></div>
            <div><Label>Duração (min) *</Label><Input type="number" value={durationMinutes} onChange={e => setDuration(e.target.value)} /></div>
          </div>
          <div><Label>URL da imagem</Label><Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} /></div>
          <div>
            <Label>Profissionais que executam</Label>
            <div className="space-y-1 mt-2 border rounded p-2">
              {professionals.length === 0 && <p className="text-sm text-muted-foreground">Cadastre profissionais primeiro.</p>}
              {professionals.map((p: SalonProfessional) => (
                <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={professionalIds.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
                  <span>{p.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2"><Switch checked={isActive} onCheckedChange={setIsActive} /><Label>Ativo</Label></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => {
            if (!name.trim()) { toast.error('Nome obrigatório'); return; }
            const dur = Number(durationMinutes);
            if (!dur || dur <= 0) { toast.error('Duração inválida'); return; }
            onSave({ id: editing?.id, storeId, name: name.trim(), description, price: Number(price) || 0, durationMinutes: dur, imageUrl, isActive, professionalIds });
          }}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==== AGENDA ====
function AgendaTab({ storeId }: { storeId: string }) {
  const [date, setDate] = useState<Date>(new Date());
  const fromIso = startOfDay(date).toISOString();
  const toIso = endOfDay(date).toISOString();
  const { data: appts = [], isLoading } = useSalonAppointments(storeId, fromIso, toIso);
  const { data: pros = [] } = useSalonProfessionals(storeId);
  const { data: products = [] } = useProducts(storeId);
  const services = products.filter(p => p.isActive);
  const updateStatus = useUpdateAppointmentStatus();
  const del = useDeleteAppointment();
  const create = useCreateAppointment();
  const [newOpen, setNewOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline"><CalendarIcon className="h-4 w-4 mr-2" />{format(date, "PPP", { locale: ptBR })}</Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} className={cn('p-3 pointer-events-auto')} /></PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={() => setDate(addDays(date, -1))}>← Dia anterior</Button>
          <Button variant="outline" size="sm" onClick={() => setDate(addDays(date, 1))}>Próximo dia →</Button>
        </div>
        <Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 mr-2" /> Novo agendamento</Button>
      </div>

      {isLoading ? <Loader2 className="animate-spin" /> : (
        <div className="space-y-2">
          {appts.length === 0 && <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum agendamento neste dia.</CardContent></Card>}
          {appts.map(a => {
            const prof = pros.find(p => p.id === a.professionalId);
            const svc = services.find(s => s.id === a.serviceId);
            return (
              <Card key={a.id}>
                <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{format(parseISO(a.startsAt), 'HH:mm')} – {format(parseISO(a.endsAt), 'HH:mm')}</div>
                    <div className="text-sm">{a.customerName} {a.customerWhatsapp && <span className="text-muted-foreground">• {a.customerWhatsapp}</span>}</div>
                    <div className="text-sm text-muted-foreground">{svc?.name || 'Serviço removido'} com {prof?.name || '?'}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={statusColors[a.status]}>{a.status}</Badge>
                    <Select value={a.status} onValueChange={(v) => updateStatus.mutate({ id: a.id, storeId, status: v as SalonAppointmentStatus })}>
                      <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reservado">Reservado</SelectItem>
                        <SelectItem value="confirmado">Confirmado</SelectItem>
                        <SelectItem value="concluido">Concluído</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm('Excluir este agendamento?')) del.mutate({ id: a.id, storeId }); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <NewAppointmentDialog open={newOpen} onClose={() => setNewOpen(false)} storeId={storeId} pros={pros} services={services} onCreate={(p) => create.mutateAsync(p).then(() => setNewOpen(false)).catch((e) => toast.error(e.message))} />
    </div>
  );
}

function NewAppointmentDialog({ open, onClose, storeId, pros, services, onCreate }: any) {
  const [serviceId, setServiceId] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState('09:00');
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  useMemo(() => {
    if (open) { setServiceId(''); setProfessionalId(''); setDate(undefined); setTime('09:00'); setName(''); setWhatsapp(''); }
  }, [open]);

  const service = services.find((s: Product) => s.id === serviceId);
  const eligiblePros = service ? pros.filter((p: SalonProfessional) => (service.professionalIds || []).includes(p.id) && p.isActive) : pros.filter((p: SalonProfessional) => p.isActive);

  const submit = () => {
    if (!service) { toast.error('Escolha um serviço'); return; }
    if (!professionalId) { toast.error('Escolha um profissional'); return; }
    if (!date) { toast.error('Escolha uma data'); return; }
    if (!name.trim()) { toast.error('Nome do cliente obrigatório'); return; }
    const [hh, mm] = time.split(':').map(Number);
    const starts = new Date(date); starts.setHours(hh, mm, 0, 0);
    const ends = addMinutes(starts, service.durationMinutes ?? 30);
    onCreate({ storeId, professionalId, serviceId, customerName: name, customerWhatsapp: whatsapp, startsAt: starts.toISOString(), endsAt: ends.toISOString() });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novo agendamento</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Serviço</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{services.map((s: Product) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.durationMinutes ?? 30}min)</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Profissional</Label>
            <Select value={professionalId} onValueChange={setProfessionalId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{eligiblePros.map((p: SalonProfessional) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start"><CalendarIcon className="h-4 w-4 mr-2" />{date ? format(date, 'dd/MM/yyyy') : 'Escolher'}</Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={setDate} className={cn('p-3 pointer-events-auto')} /></PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Hora</Label>
              <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>
          <div><Label>Nome do cliente</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>WhatsApp</Label><Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit}>Criar agendamento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}