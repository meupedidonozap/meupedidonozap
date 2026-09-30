import { useMemo, useState } from 'react';
import { Loader2, MapPin, Search, LogIn as LogInIcon, LogOut as LogOutIcon, ShoppingCart, History, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDateTime } from '@/lib/formatters';
import { haversineMeters, getCurrentPosition } from '@/lib/geo';
import {
  useCheckIn, useCheckOut, useCustomerVisits, geocodeAddress, saveCustomerGeo,
  DEFAULT_VISIT_REASONS, formatDuration, type CustomerVisit,
} from '@/hooks/useCustomerVisits';
import type { SellerCustomer } from '@/contexts/SellerContext';

interface CustomerRow {
  id: string;
  name: string;
  customer_code: string;
  cpf_cnpj: string;
  whatsapp: string;
  address: string;
  number: string;
  neighborhood: string;
  city: string;
  uf: string;
  cep: string;
  seller_code: string;
  price_table: number;
  geo_lat: number | null;
  geo_lng: number | null;
}

function fullAddress(c: CustomerRow) {
  return [
    [c.address, c.number].filter(Boolean).join(', '),
    c.neighborhood,
    [c.city, c.uf].filter(Boolean).join('/'),
    c.cep,
    'Brasil',
  ].filter(Boolean).join(' - ');
}

function useWalletCustomers(storeId: string | undefined, sellerCodes: string[]) {
  return useQuery({
    queryKey: ['checkin-customers', storeId, sellerCodes.join(',')],
    queryFn: async () => {
      let q = supabase
        .from('customer_profiles')
        .select('id, name, customer_code, cpf_cnpj, whatsapp, address, number, neighborhood, city, uf, cep, seller_code, price_table, geo_lat, geo_lng, is_active')
        .eq('store_id', storeId!)
        .order('name');
      if (sellerCodes.length > 0) q = q.in('seller_code', sellerCodes);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).filter((r: any) => r.is_active !== false) as CustomerRow[];
    },
    enabled: !!storeId,
  });
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  sellerCodes: string[];
  unvisitedPeriodDays: number;
  visitReasons: string[];
  maxDistanceMeters: number;
  /** Seleciona o cliente no Modo Vendedor após o check-in. */
  onCustomerSelected?: (c: SellerCustomer) => void;
}

export default function CheckinDialog({
  open, onOpenChange, storeId, sellerCodes,
  unvisitedPeriodDays, visitReasons, maxDistanceMeters, onCustomerSelected,
}: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [onlyUnvisited, setOnlyUnvisited] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [historyOf, setHistoryOf] = useState<CustomerRow | null>(null);
  const [checkoutVisit, setCheckoutVisit] = useState<CustomerVisit | null>(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const { data: customers = [], isLoading } = useWalletCustomers(storeId, sellerCodes);
  const sinceIso = useMemo(
    () => new Date(Date.now() - Math.max(unvisitedPeriodDays, 1) * 24 * 3600 * 1000).toISOString(),
    [unvisitedPeriodDays],
  );
  const { data: periodVisits = [] } = useCustomerVisits(storeId, { onlyMine: true, sinceIso });
  const { data: allVisits = [] } = useCustomerVisits(storeId, { onlyMine: true });

  const checkIn = useCheckIn();
  const checkOut = useCheckOut();

  const lastVisitByCustomer = useMemo(() => {
    const m = new Map<string, CustomerVisit>();
    for (const v of allVisits) if (!m.has(v.customer_profile_id)) m.set(v.customer_profile_id, v);
    return m;
  }, [allVisits]);

  const openVisitByCustomer = useMemo(() => {
    const m = new Map<string, CustomerVisit>();
    for (const v of allVisits) if (!v.checked_out_at && !m.has(v.customer_profile_id)) m.set(v.customer_profile_id, v);
    return m;
  }, [allVisits]);

  const visitedInPeriod = useMemo(
    () => new Set(periodVisits.map(v => v.customer_profile_id)),
    [periodVisits],
  );

  const todayCount = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return allVisits.filter(v => new Date(v.checked_in_at) >= start).length;
  }, [allVisits]);

  const filtered = useMemo(() => {
    let base = customers;
    if (onlyUnvisited) base = base.filter(c => !visitedInPeriod.has(c.id));
    const q = search.trim().toLowerCase();
    if (!q) return base.slice(0, 400);
    const digits = q.replace(/\D/g, '');
    return base.filter(c => {
      const hay = [c.name, c.customer_code, c.cpf_cnpj, c.whatsapp, c.city, c.uf, c.address].filter(Boolean).join(' ').toLowerCase();
      if (hay.includes(q)) return true;
      return digits.length >= 3 && hay.replace(/\D/g, '').includes(digits);
    }).slice(0, 400);
  }, [customers, onlyUnvisited, visitedInPeriod, search]);

  const periodLabel = useMemo(() => {
    const from = new Date(Date.now() - unvisitedPeriodDays * 24 * 3600 * 1000);
    return `Não atendido de ${from.toLocaleDateString('pt-BR')} até ${new Date().toLocaleDateString('pt-BR')}`;
  }, [unvisitedPeriodDays]);

  async function handleCheckIn(c: CustomerRow) {
    setBusyId(c.id);
    try {
      let geo = c.geo_lat != null && c.geo_lng != null
        ? { lat: Number(c.geo_lat), lng: Number(c.geo_lng) }
        : await geocodeAddress(fullAddress(c));

      let my: { lat: number; lng: number } | null = null;
      try { my = await getCurrentPosition(); } catch { my = null; }
      if (!my) { toast.error('Ative a localização do aparelho para registrar a visita.'); return; }

      if (!geo) {
        geo = my;
        await saveCustomerGeo(c.id, my.lat, my.lng);
        qc.invalidateQueries({ queryKey: ['checkin-customers', storeId] });
        toast.info('Local do cliente salvo pela sua posição atual.');
      }

      const dist = haversineMeters(my.lat, my.lng, geo.lat, geo.lng);
      if (dist > maxDistanceMeters) {
        toast.warning(
          `Atenção: você está a ${Math.round(dist)}m do cliente (recomendado até ${maxDistanceMeters}m). Check-in registrado mesmo assim.`,
        );
      }


      await checkIn.mutateAsync({
        storeId,
        customerProfileId: c.id,
        sellerCode: c.seller_code || null,
        lat: my.lat,
        lng: my.lng,
        distanceMeters: dist,
      });
      qc.invalidateQueries({ queryKey: ['open-visit', storeId] });
      onCustomerSelected?.({
        id: c.id,
        name: c.name,
        customerCode: c.customer_code,
        whatsapp: c.whatsapp,
        cpfCnpj: c.cpf_cnpj,
        cep: c.cep,
        uf: c.uf,
        city: c.city,
        neighborhood: c.neighborhood,
        address: c.address,
        number: c.number,
        sellerCode: c.seller_code,
        storeId,

        priceTable: c.price_table,
      } as unknown as SellerCustomer);
      toast.success(`Check-in registrado em ${c.name}.`);
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível registrar o check-in.');
    } finally {
      setBusyId(null);
    }
  }

  function openCheckout(v: CustomerVisit) {
    setReason('');
    setNotes('');
    setCheckoutVisit(v);
  }

  async function confirmCheckout() {
    if (!checkoutVisit) return;
    if (!reason) { toast.error('Escolha o motivo/resultado da visita.'); return; }
    let my: { lat: number; lng: number } | null = null;
    try { my = await getCurrentPosition(); } catch { my = null; }
    try {
      const v = await checkOut.mutateAsync({
        visitId: checkoutVisit.id,
        lat: my?.lat ?? null,
        lng: my?.lng ?? null,
        reason,
        notes: notes.trim() || undefined,
        checkedInAt: checkoutVisit.checked_in_at,
      });
      qc.invalidateQueries({ queryKey: ['open-visit', storeId] });
      toast.success(`Visita encerrada. Tempo total: ${formatDuration(v.duration_seconds)}.`);
      setCheckoutVisit(null);
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível encerrar a visita.');
    }
  }

  const historyVisits = useMemo(
    () => (historyOf ? allVisits.filter(v => v.customer_profile_id === historyOf.id) : []),
    [historyOf, allVisits],
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle>Atendimento — Check-in de clientes</DialogTitle></DialogHeader>

          <Tabs defaultValue="clientes" className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <TabsList className="w-full shrink-0">
              <TabsTrigger value="clientes" className="flex-1">Clientes</TabsTrigger>
              <TabsTrigger value="hoje" className="flex-1">Visitas de hoje ({todayCount})</TabsTrigger>
            </TabsList>

            <TabsContent value="clientes" className="mt-3 flex-1 min-h-0 overflow-hidden flex flex-col space-y-3 data-[state=inactive]:hidden">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Nome, código, cidade ou CNPJ..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge
                  variant={onlyUnvisited ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setOnlyUnvisited(v => !v)}
                >
                  {periodLabel} {onlyUnvisited ? '✕' : ''}
                </Badge>
                <span className="text-xs text-muted-foreground">{filtered.length} clientes</span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain rounded-md border [scrollbar-width:thin] [scrollbar-gutter:stable]">
                {isLoading ? (
                  <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : filtered.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
                ) : (
                  <div className="divide-y">
                    {filtered.map(c => {
                      const last = lastVisitByCustomer.get(c.id);
                      const openV = openVisitByCustomer.get(c.id);
                      return (
                        <div key={c.id} className="p-3 space-y-2">
                          <div>
                            <p className="text-sm font-semibold">{c.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {c.customer_code ? `#${c.customer_code} • ` : ''}{c.cpf_cnpj || '—'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {[c.city, c.uf].filter(Boolean).join('/')} {c.whatsapp ? `• ${c.whatsapp}` : ''}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Últ. atend.: {last ? formatDateTime(last.checked_in_at) : '—'}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {openV ? (
                              <Button size="sm" variant="destructive" onClick={() => openCheckout(openV)}>
                                <LogOutIcon className="mr-1 h-4 w-4" /> Fazer Checkout
                              </Button>
                            ) : (
                              <Button size="sm" onClick={() => handleCheckIn(c)} disabled={busyId === c.id}>
                                {busyId === c.id
                                  ? <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                  : <MapPin className="mr-1 h-4 w-4" />}
                                Fazer Checkin
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                onCustomerSelected?.({
                                  id: c.id, name: c.name, customerCode: c.customer_code,
                                  whatsapp: c.whatsapp, cpfCnpj: c.cpf_cnpj, cep: c.cep, uf: c.uf,
                                  city: c.city, neighborhood: c.neighborhood, address: c.address,
                                  number: c.number, sellerCode: c.seller_code, priceTable: c.price_table,
                                  storeId,

                                } as unknown as SellerCustomer);
                                onOpenChange(false);
                              }}
                            >
                              <ShoppingCart className="mr-1 h-4 w-4" /> Novo Pedido
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setHistoryOf(c)}>
                              <History className="mr-1 h-4 w-4" /> Histórico
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="hoje" className="mt-3 flex-1 min-h-0 overflow-hidden data-[state=inactive]:hidden">
              <div className="h-full min-h-[300px] overflow-y-auto overscroll-contain rounded-md border [scrollbar-width:thin] [scrollbar-gutter:stable]">
                {(() => {
                  const start = new Date(); start.setHours(0, 0, 0, 0);
                  const rows = allVisits.filter(v => new Date(v.checked_in_at) >= start);
                  if (rows.length === 0) return <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma visita registrada hoje.</p>;
                  const nameById = new Map(customers.map(c => [c.id, c.name]));
                  return (
                    <div className="divide-y">
                      {rows.map(v => (
                        <div key={v.id} className="p-3 text-sm">
                          <p className="font-medium">{nameById.get(v.customer_profile_id) || 'Cliente'}</p>
                          <p className="text-xs text-muted-foreground">
                            Entrada {formatDateTime(v.checked_in_at)}
                            {v.checked_out_at ? ` • Saída ${formatDateTime(v.checked_out_at)}` : ' • em andamento'}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {formatDuration(v.duration_seconds)}
                            {v.checkout_reason ? ` • ${v.checkout_reason}` : ''}
                          </p>
                          {!v.checked_out_at && (
                            <Button size="sm" variant="destructive" className="mt-2" onClick={() => openCheckout(v)}>
                              <LogOutIcon className="mr-1 h-4 w-4" /> Fazer Checkout
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Checkout */}
      <Dialog open={!!checkoutVisit} onOpenChange={o => !o && setCheckoutVisit(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Encerrar visita (Checkout)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {checkoutVisit && (
              <p className="text-xs text-muted-foreground">
                Entrada: {formatDateTime(checkoutVisit.checked_in_at)}
              </p>
            )}
            <div className="grid gap-1">
              <Label className="text-sm">Motivo / Resultado da visita *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(visitReasons.length ? visitReasons : DEFAULT_VISIT_REASONS).map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-sm">Observações</Label>
              <Textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Resumo do atendimento..." />
            </div>
            <Button className="w-full" onClick={confirmCheckout} disabled={checkOut.isPending}>
              {checkOut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogInIcon className="mr-2 h-4 w-4" />}
              Registrar Checkout
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Histórico */}
      <Dialog open={!!historyOf} onOpenChange={o => !o && setHistoryOf(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Histórico — {historyOf?.name}</DialogTitle></DialogHeader>
          <ScrollArea className="h-[340px] rounded-md border">
            {historyVisits.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma visita registrada.</p>
            ) : (
              <div className="divide-y">
                {historyVisits.map(v => (
                  <div key={v.id} className="p-3 text-sm">
                    <p className="font-medium">{formatDateTime(v.checked_in_at)}</p>
                    <p className="text-xs text-muted-foreground">
                      Tempo: {formatDuration(v.duration_seconds)}
                      {v.checkout_reason ? ` • ${v.checkout_reason}` : ''}
                    </p>
                    {v.checkout_notes && <p className="mt-1 text-xs">{v.checkout_notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
