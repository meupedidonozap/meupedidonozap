import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MapPin, LogIn as LogInIcon, LogOut as LogOutIcon, Navigation, Search, RefreshCw, AlertTriangle, MapPinned, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDateTime } from '@/lib/formatters';
import { haversineMeters, getCurrentPosition, loadGoogleMaps, onGoogleMapsAuthFailure } from '@/lib/geo';
import { useCheckIn, useCheckOut, useCustomerVisits, geocodeAddress, saveCustomerGeo, formatDuration, DEFAULT_VISIT_REASONS, OUT_OF_RANGE_REASONS, reverseGeocode, logGeoChange, useGeoChanges, type CustomerVisit, type GeoChange } from '@/hooks/useCustomerVisits';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


const MAX_CHECKIN_METERS = 300;

interface CustomerRow {
  id: string;
  name: string;
  whatsapp: string;
  address: string;
  number: string;
  neighborhood: string;
  city: string;
  uf: string;
  cep: string;
  seller_code: string;
  customer_code: string;
  geo_lat: number | null;
  geo_lng: number | null;
}

function fullAddress(c: CustomerRow) {
  const parts = [
    [c.address, c.number].filter(Boolean).join(', '),
    c.neighborhood,
    [c.city, c.uf].filter(Boolean).join('/'),
    c.cep,
    'Brasil',
  ].filter(Boolean);
  return parts.join(' - ');
}

function useSellerCustomers(storeId: string | undefined, sellerCodes: string[]) {
  return useQuery({
    queryKey: ['atendimento-customers', storeId, sellerCodes.join(',')],
    queryFn: async () => {
      let q = supabase
        .from('customer_profiles')
        .select('id, name, whatsapp, address, number, neighborhood, city, uf, cep, seller_code, customer_code, geo_lat, geo_lng, is_active')
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

function MiniMap({
  customer,
  sellerCoords,
  editable,
  onPositionChange,
}: {
  customer: CustomerRow;
  sellerCoords: { lat: number; lng: number } | null;
  editable?: boolean;
  onPositionChange?: (pos: { lat: number; lng: number }) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const off = onGoogleMapsAuthFailure(() => {
      setErr('Google Maps não autorizou este domínio. Verifique a chave nas configurações do conector.');
    });
    if (!ref.current || customer.geo_lat == null || customer.geo_lng == null) return;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !ref.current) return;
        const center = { lat: Number(customer.geo_lat), lng: Number(customer.geo_lng) };
        const map = new g.maps.Map(ref.current, {
          center,
          zoom: 16,
          disableDefaultUI: true,
          zoomControl: true,
        });
        const marker = new g.maps.Marker({
          position: center,
          map,
          title: customer.name,
          draggable: !!editable,
        });
        if (editable) {
          marker.addListener('dragend', () => {
            const p = marker.getPosition();
            if (p) onPositionChange?.({ lat: p.lat(), lng: p.lng() });
          });
          map.addListener('click', (e: any) => {
            marker.setPosition(e.latLng);
            onPositionChange?.({ lat: e.latLng.lat(), lng: e.latLng.lng() });
          });
        }
        if (sellerCoords) {
          new g.maps.Marker({
            position: sellerCoords,
            map,
            title: 'Você',
            icon: {
              path: g.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#2563eb',
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 2,
            },
          });
          const bounds = new g.maps.LatLngBounds();
          bounds.extend(center);
          bounds.extend(sellerCoords);
          map.fitBounds(bounds, 60);
        }
      })
      .catch((e) => setErr(e.message));
    return () => {
      cancelled = true;
      off();
    };
  }, [customer.id, customer.geo_lat, customer.geo_lng, sellerCoords?.lat, sellerCoords?.lng, editable]);

  if (err) return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive space-y-2">
      <p className="flex items-center gap-1 font-semibold"><AlertTriangle className="h-4 w-4" /> Mapa indisponível</p>
      <p>{err}</p>
      {customer.geo_lat != null && customer.geo_lng != null && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${customer.geo_lat},${customer.geo_lng}`}
          target="_blank" rel="noreferrer"
          className="underline text-primary"
        >Abrir no Google Maps</a>
      )}
    </div>
  );
  return <div ref={ref} className="h-56 w-full rounded-md border bg-muted" />;
}

export default function AtendimentoTab(props: { storeId: string; sellerCodes: string[]; isAdmin: boolean; visitReasons?: string[] }) {
  const [view, setView] = useState<'atendimento' | 'localizacoes'>('atendimento');
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button size="sm" variant={view === 'atendimento' ? 'default' : 'outline'} onClick={() => setView('atendimento')}>
          <MapPin className="h-4 w-4 mr-1" /> Atendimentos
        </Button>
        <Button size="sm" variant={view === 'localizacoes' ? 'default' : 'outline'} onClick={() => setView('localizacoes')}>
          <MapPinned className="h-4 w-4 mr-1" /> Alterações de localização
        </Button>
      </div>
      {view === 'atendimento' ? <AtendimentoMain {...props} /> : <GeoChangesDashboard storeId={props.storeId} />}
    </div>
  );
}

function AtendimentoMain({ storeId, sellerCodes, isAdmin, visitReasons = DEFAULT_VISIT_REASONS }: { storeId: string; sellerCodes: string[]; isAdmin: boolean; visitReasons?: string[] }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sellerCoords, setSellerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [geocodingId, setGeocodingId] = useState<string | null>(null);
  const [showOnlyPending, setShowOnlyPending] = useState(false);
  const [showOnlyNoGeo, setShowOnlyNoGeo] = useState(false);
  const [periodDays, setPeriodDays] = useState(90);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [pendingPos, setPendingPos] = useState<{ lat: number; lng: number } | null>(null);
  const [savingPos, setSavingPos] = useState(false);
  const [outOfRange, setOutOfRange] = useState<{ customer: CustomerRow; my: { lat: number; lng: number }; dist: number | null } | null>(null);
  const [oorReason, setOorReason] = useState('');
  const [oorNotes, setOorNotes] = useState('');
  const [oorUpdateGeo, setOorUpdateGeo] = useState(true);
  const [oorSaving, setOorSaving] = useState(false);

  const sinceIso = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - periodDays);
    return d.toISOString();
  }, [periodDays]);

  const { data: customers = [], isLoading, refetch } = useSellerCustomers(storeId, isAdmin ? [] : sellerCodes);
  const { data: visits = [] } = useCustomerVisits(storeId, {
    onlyMine: !isAdmin,
    sinceIso,
  });

  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const [checkoutVisit, setCheckoutVisit] = useState<CustomerVisit | null>(null);
  const [coReason, setCoReason] = useState('');
  const [coNotes, setCoNotes] = useState('');


  const openVisitByCustomer = useMemo(() => {
    const m = new Map<string, CustomerVisit>();
    for (const v of visits) {
      if (!v.checked_out_at && !m.has(v.customer_profile_id)) m.set(v.customer_profile_id, v);
    }
    return m;
  }, [visits]);

  const visitCountByCustomer = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of visits) m.set(v.customer_profile_id, (m.get(v.customer_profile_id) ?? 0) + 1);
    return m;
  }, [visits]);

  const lastVisitByCustomer = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of visits) if (!m.has(v.customer_profile_id)) m.set(v.customer_profile_id, v.checked_in_at);
    return m;
  }, [visits]);

  const isPendingVisit = (c: CustomerRow) => !visitCountByCustomer.has(c.id);

  const filtered = useMemo(() => {
    let base = customers;
    if (showOnlyPending) base = base.filter(isPendingVisit);
    if (showOnlyNoGeo) base = base.filter((c) => c.geo_lat == null || c.geo_lng == null);
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.customer_code || '').toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q) ||
        (c.city || '').toLowerCase().includes(q) ||
        (c.whatsapp || '').includes(q),
    );
  }, [customers, search, showOnlyPending, showOnlyNoGeo, visitCountByCustomer]);

  const pendingCount = useMemo(
    () => customers.filter((c) => c.geo_lat == null || c.geo_lng == null).length,
    [customers],
  );
  const noVisitCount = useMemo(() => customers.filter(isPendingVisit).length, [customers, visitCountByCustomer]);

  const selected = customers.find((c) => c.id === selectedId) || null;

  useEffect(() => {
    setEditingLocation(false);
    setPendingPos(null);
  }, [selectedId]);

  async function handleBulkGeocode() {
    setBulkRunning(true);
    try {
      toast.info('Localizando clientes... Isso pode levar alguns minutos.');
      const { data, error } = await supabase.functions.invoke('bulk-geocode-customers', {
        body: { storeId },
      });
      if (error) throw error;
      const d = data as { total: number; ok: number; failed: number; skipped: number };
      toast.success(`Concluído: ${d.ok} localizados, ${d.failed} falharam, ${d.skipped} sem endereço.`);
      await qc.invalidateQueries({ queryKey: ['atendimento-customers', storeId] });
    } catch (e: any) {
      toast.error(e.message || 'Falha ao localizar em lote.');
    } finally {
      setBulkRunning(false);
    }
  }

  async function saveManualPosition() {
    if (!selected || !pendingPos) return;
    setSavingPos(true);
    try {
      await saveCustomerGeo(selected.id, pendingPos.lat, pendingPos.lng);
      await qc.invalidateQueries({ queryKey: ['atendimento-customers', storeId] });
      toast.success('Localização atualizada.');
      setEditingLocation(false);
      setPendingPos(null);
    } catch (e: any) {
      toast.error(e.message || 'Falha ao salvar localização.');
    } finally {
      setSavingPos(false);
    }
  }

  async function startManualEdit(c: CustomerRow) {
    if (c.geo_lat == null || c.geo_lng == null) {
      setGeocodingId(c.id);
      try {
        const seed = await geocodeAddress(
          [c.cep, c.city, c.uf, 'Brasil'].filter(Boolean).join(', '),
        );
        if (seed) {
          await saveCustomerGeo(c.id, seed.lat, seed.lng);
          await qc.invalidateQueries({ queryKey: ['atendimento-customers', storeId] });
        } else {
          toast.error('Não foi possível estimar um ponto inicial.');
          return;
        }
      } finally {
        setGeocodingId(null);
      }
    }
    setEditingLocation(true);
  }

  async function acquireLocation() {
    setLocating(true);
    try {
      const c = await getCurrentPosition();
      setSellerCoords(c);
      return c;
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível obter sua localização.');
      return null;
    } finally {
      setLocating(false);
    }
  }

  async function ensureCustomerGeo(c: CustomerRow): Promise<{ lat: number; lng: number } | null> {
    if (c.geo_lat != null && c.geo_lng != null) return { lat: Number(c.geo_lat), lng: Number(c.geo_lng) };
    setGeocodingId(c.id);
    try {
      const geo = await geocodeAddress(fullAddress(c));
      if (!geo) {
        toast.error('Não foi possível localizar o endereço do cliente.');
        return null;
      }
      await saveCustomerGeo(c.id, geo.lat, geo.lng);
      await qc.invalidateQueries({ queryKey: ['atendimento-customers', storeId] });
      return geo;
    } finally {
      setGeocodingId(null);
    }
  }

  async function handleCheckIn(c: CustomerRow) {
    const geo = await ensureCustomerGeo(c);
    const my = sellerCoords ?? (await acquireLocation());
    if (!my) return;
    const dist = geo ? haversineMeters(my.lat, my.lng, geo.lat, geo.lng) : Infinity;
    if (dist > MAX_CHECKIN_METERS) {
      setOorReason('');
      setOorNotes('');
      setOorUpdateGeo(true);
      setOutOfRange({ customer: c, my, dist: Number.isFinite(dist) ? dist : null });
      return;
    }
    try {
      await checkIn.mutateAsync({
        storeId,
        customerProfileId: c.id,
        sellerCode: c.seller_code || null,
        lat: my.lat,
        lng: my.lng,
        distanceMeters: dist,
      });
      toast.success(`Check-in registrado (${Math.round(dist)}m).`);
    } catch (e: any) {
      toast.error(e.message || 'Falha ao registrar check-in.');
    }
  }

  async function confirmOutOfRange() {
    if (!outOfRange) return;
    if (!oorReason) { toast.error('Escolha a justificativa.'); return; }
    if (oorReason === 'Outro' && !oorNotes.trim()) { toast.error('Descreva a justificativa.'); return; }
    const { customer: c, my, dist } = outOfRange;
    setOorSaving(true);
    try {
      const visit = await checkIn.mutateAsync({
        storeId,
        customerProfileId: c.id,
        sellerCode: c.seller_code || null,
        lat: my.lat,
        lng: my.lng,
        distanceMeters: dist ?? 0,
        outOfRangeReason: oorReason,
        outOfRangeNotes: oorNotes.trim() || null,
      });
      if (oorUpdateGeo) {
        const newAddress = await reverseGeocode(my.lat, my.lng);
        await logGeoChange({
          store_id: storeId,
          customer_profile_id: c.id,
          visit_id: visit.id,
          seller_code: c.seller_code || null,
          customer_name: c.name,
          customer_code: c.customer_code || null,
          old_address: fullAddress(c),
          old_lat: c.geo_lat != null ? Number(c.geo_lat) : null,
          old_lng: c.geo_lng != null ? Number(c.geo_lng) : null,
          new_lat: my.lat,
          new_lng: my.lng,
          new_address: newAddress,
          distance_meters: dist != null ? Math.round(dist) : null,
          reason: oorReason,
          notes: oorNotes.trim() || null,
        });
        await saveCustomerGeo(c.id, my.lat, my.lng);
        await qc.invalidateQueries({ queryKey: ['atendimento-customers', storeId] });
        await qc.invalidateQueries({ queryKey: ['customer-geo-changes', storeId] });
      }
      toast.success(oorUpdateGeo ? 'Check-in registrado e localização do cliente atualizada.' : 'Check-in registrado com justificativa.');
      setOutOfRange(null);
    } catch (e: any) {
      toast.error(e.message || 'Falha ao registrar check-in.');
    } finally {
      setOorSaving(false);
    }
  }

  function handleCheckOut(visit: CustomerVisit) {
    setCoReason('');
    setCoNotes('');
    setCheckoutVisit(visit);
  }

  async function confirmCheckOut() {
    if (!checkoutVisit) return;
    if (!coReason) { toast.error('Escolha o motivo/resultado da visita.'); return; }
    let my: { lat: number; lng: number } | null = null;
    try { my = await getCurrentPosition(); } catch { my = null; }
    try {
      const v = await checkOut.mutateAsync({
        visitId: checkoutVisit.id,
        lat: my?.lat ?? null,
        lng: my?.lng ?? null,
        reason: coReason,
        notes: coNotes.trim() || undefined,
        checkedInAt: checkoutVisit.checked_in_at,
      });
      toast.success(`Visita encerrada. Tempo total: ${formatDuration(v.duration_seconds)}.`);
      setCheckoutVisit(null);
    } catch (e: any) {
      toast.error(e.message || 'Falha ao registrar check-out.');
    }
  }


  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      {/* Lista */}
      <Card className="p-3 space-y-3">
        {isAdmin && pendingCount > 0 && (
          <div className="rounded-md border border-amber-500/40 bg-amber-50 p-2 text-xs space-y-2">
            <p className="flex items-center gap-1 text-amber-900 font-medium">
              <AlertTriangle className="h-4 w-4" />
              {pendingCount} cliente{pendingCount > 1 ? 's' : ''} sem localização
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleBulkGeocode} disabled={bulkRunning}>
                {bulkRunning ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <MapPinned className="h-3 w-3 mr-1" />}
                Localizar todos
              </Button>
            </div>
          </div>
        )}
        <div className="rounded-md border p-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium">Período:</span>
            {[30, 60, 90].map((d) => (
              <Button key={d} size="sm" variant={periodDays === d ? 'default' : 'outline'} className="h-7 px-2" onClick={() => setPeriodDays(d)}>{d} dias</Button>
            ))}
            <Input type="number" min={1} max={730} value={periodDays} onChange={(e) => setPeriodDays(Math.max(1, Math.min(730, Number(e.target.value) || 1)))} className="h-7 w-20" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={showOnlyPending ? 'default' : 'outline'} onClick={() => setShowOnlyPending((v) => !v)}>
              Sem visita ({noVisitCount})
            </Button>
            <Button size="sm" variant={showOnlyNoGeo ? 'default' : 'outline'} onClick={() => setShowOnlyNoGeo((v) => !v)}>
              Sem localização ({pendingCount})
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nome, código, endereço, cidade..."
              className="pl-8"
            />
          </div>
          <Button size="icon" variant="outline" onClick={() => refetch()} title="Recarregar">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={acquireLocation} disabled={locating} title="Atualizar minha localização">
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
          </Button>
        </div>
        {sellerCoords && (
          <p className="text-[11px] text-muted-foreground">
            Sua posição: {sellerCoords.lat.toFixed(5)}, {sellerCoords.lng.toFixed(5)}
          </p>
        )}
        <div className="max-h-[70vh] overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum cliente encontrado.</p>
          ) : (
            filtered.map((c) => {
              const openVisit = openVisitByCustomer.get(c.id);
              const count = visitCountByCustomer.get(c.id) ?? 0;
              const active = c.id === selectedId;
              const pending = c.geo_lat == null || c.geo_lng == null;
              const noVisit = isPendingVisit(c);
              const last = lastVisitByCustomer.get(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left rounded-md border p-2 transition ${active ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{c.customer_code ? `${c.customer_code} · ` : ''}{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        <MapPin className="inline h-3 w-3 mr-1" />
                        {c.address}{c.number ? `, ${c.number}` : ''} · {c.neighborhood} · {c.city}/{c.uf}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {openVisit && <Badge className="bg-green-600">Em atendimento</Badge>}
                      {pending && <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50 text-[10px]">Sem localização</Badge>}
                      {noVisit && !openVisit && <Badge variant="destructive" className="text-[10px]">Sem visita</Badge>}
                      {last && <span className="text-[10px] text-muted-foreground">Últ.: {formatDateTime(last)}</span>}
                      {count > 0 && <span className="text-[10px] text-muted-foreground">{count} visita{count > 1 ? 's' : ''}</span>}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </Card>

      {/* Detalhe */}
      <Card className="p-3">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full py-10 text-muted-foreground text-sm">
            <MapPin className="h-8 w-8 mb-2 opacity-40" />
            Selecione um cliente à esquerda
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-lg">{selected.customer_code ? `${selected.customer_code} · ` : ''}{selected.name}</h3>
              <p className="text-sm text-muted-foreground">{fullAddress(selected)}</p>
              {selected.whatsapp && <p className="text-xs text-muted-foreground">WhatsApp: {selected.whatsapp}</p>}
              <p className="text-xs text-muted-foreground">Última visita: {lastVisitByCustomer.get(selected.id) ? formatDateTime(lastVisitByCustomer.get(selected.id)!) : `nenhuma nos últimos ${periodDays} dias`}</p>
              <Button asChild size="sm" variant="outline" className="mt-2">
                <a target="_blank" rel="noreferrer" href={selected.geo_lat != null && selected.geo_lng != null
                  ? `https://www.google.com/maps/dir/?api=1&destination=${selected.geo_lat},${selected.geo_lng}`
                  : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress(selected))}`}>
                  <Navigation className="h-4 w-4 mr-2" /> Como chegar
                </a>
              </Button>
            </div>

            {selected.geo_lat == null || selected.geo_lng == null ? (
              <div className="rounded-md border border-amber-500/40 p-3 space-y-2 bg-amber-50">
                <p className="text-sm text-amber-900 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  Endereço deste cliente ainda não foi localizado no mapa. Localize pelo endereço ou ajuste manualmente.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => ensureCustomerGeo(selected)}
                    disabled={geocodingId === selected.id}
                  >
                    {geocodingId === selected.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MapPin className="h-4 w-4 mr-2" />}
                    Localizar pelo endereço
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => startManualEdit(selected)} disabled={geocodingId === selected.id}>
                    <MapPinned className="h-4 w-4 mr-2" />
                    Ajustar no mapa
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <MiniMap
                  customer={selected}
                  sellerCoords={sellerCoords}
                  editable={editingLocation}
                  onPositionChange={setPendingPos}
                />
                {editingLocation ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs text-muted-foreground flex-1">
                      Arraste o marcador ou clique no mapa para posicionar o cliente.
                    </p>
                    <Button size="sm" onClick={saveManualPosition} disabled={!pendingPos || savingPos}>
                      {savingPos ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Confirmar posição
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditingLocation(false); setPendingPos(null); }}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setEditingLocation(true)}>
                    <MapPinned className="h-4 w-4 mr-2" />
                    Ajustar posição no mapa
                  </Button>
                )}
              </>
            )}

            {sellerCoords && selected.geo_lat != null && selected.geo_lng != null && (
              <p className="text-xs text-muted-foreground">
                Distância até o cliente:{' '}
                <span className="font-semibold text-foreground">
                  {Math.round(haversineMeters(sellerCoords.lat, sellerCoords.lng, Number(selected.geo_lat), Number(selected.geo_lng)))}m
                </span>{' '}
                (limite {MAX_CHECKIN_METERS}m)
              </p>
            )}

            {(() => {
              const openVisit = openVisitByCustomer.get(selected.id);
              if (openVisit) {
                return (
                  <div className="rounded-md border border-green-600/30 bg-green-50 p-3 space-y-2">
                    <p className="text-sm">
                      <Badge className="bg-green-600 mr-2">Em atendimento</Badge>
                      Check-in: {formatDateTime(openVisit.checked_in_at)}
                    </p>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleCheckOut(openVisit)}
                      disabled={checkOut.isPending || locating}
                    >
                      {checkOut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogOutIcon className="h-4 w-4 mr-2" />}
                      Registrar check-out
                    </Button>
                  </div>
                );
              }
              return (
                <Button
                  onClick={() => handleCheckIn(selected)}
                  disabled={checkIn.isPending || locating || geocodingId === selected.id}
                  className="w-full"
                >
                  {checkIn.isPending || locating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <LogInIcon className="h-4 w-4 mr-2" />
                  )}
                  Fazer check-in
                </Button>
              );
            })()}

            {/* Histórico recente */}
            {(() => {
              const list = visits.filter((v) => v.customer_profile_id === selected.id).slice(0, 5);
              if (list.length === 0) return null;
              return (
                <div className="pt-2 border-t">
                  <p className="text-xs font-semibold mb-1">Últimas visitas</p>
                  <ul className="text-xs space-y-1">
                    {list.map((v) => (
                      <li key={v.id} className="space-y-0.5">
                        <div className="flex justify-between gap-2">
                          <span>{formatDateTime(v.checked_in_at)}</span>
                          <span className="text-muted-foreground">
                            {v.checked_out_at ? `→ ${formatDateTime(v.checked_out_at)}` : 'em aberto'}
                            {v.duration_seconds != null && ` · ${formatDuration(v.duration_seconds)}`}
                          </span>
                        </div>
                        {v.checkout_reason && <p className="text-muted-foreground">Resultado: {v.checkout_reason}</p>}
                        {v.checkout_notes && <p className="text-muted-foreground">{v.checkout_notes}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}
          </div>
        )}
      </Card>

      <Dialog open={!!checkoutVisit} onOpenChange={(o) => !o && setCheckoutVisit(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Encerrar visita (Checkout)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {checkoutVisit && (
              <p className="text-xs text-muted-foreground">Entrada: {formatDateTime(checkoutVisit.checked_in_at)}</p>
            )}
            <div className="grid gap-1">
              <Label className="text-sm">Motivo / Resultado da visita *</Label>
              <Select value={coReason} onValueChange={setCoReason}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(visitReasons.length ? visitReasons : DEFAULT_VISIT_REASONS).map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-sm">Observações</Label>
              <Textarea rows={4} value={coNotes} onChange={(e) => setCoNotes(e.target.value)} placeholder="Resumo do atendimento..." />
            </div>
            <Button className="w-full" onClick={confirmCheckOut} disabled={checkOut.isPending}>
              {checkOut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOutIcon className="mr-2 h-4 w-4" />}
              Registrar Checkout
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!outOfRange} onOpenChange={(o) => !o && setOutOfRange(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Check-in fora do raio</DialogTitle></DialogHeader>
          {outOfRange && (
            <div className="space-y-3">
              <p className="text-sm rounded-md border border-destructive/40 bg-destructive/5 p-2">
                {outOfRange.dist != null
                  ? <>Você está a <b>{Math.round(outOfRange.dist)} m</b> do local registrado do cliente (limite {MAX_CHECKIN_METERS} m).</>
                  : <>O cliente ainda não tem localização registrada.</>}
              </p>
              <div className="grid gap-1">
                <Label className="text-sm">Justificativa *</Label>
                <Select value={oorReason} onValueChange={setOorReason}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {OUT_OF_RANGE_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label className="text-sm">Detalhes</Label>
                <Textarea rows={3} value={oorNotes} onChange={(e) => setOorNotes(e.target.value)} placeholder="Explique o motivo..." />
              </div>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={oorUpdateGeo} onCheckedChange={(v) => setOorUpdateGeo(!!v)} />
                <span>Gravar minha posição atual como nova localização deste cliente</span>
              </label>
              <Button className="w-full" onClick={confirmOutOfRange} disabled={oorSaving}>
                {oorSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogInIcon className="mr-2 h-4 w-4" />}
                Confirmar check-in
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>

  );
}

function CompareMap({ change }: { change: GeoChange }) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then((g) => {
      if (cancelled || !ref.current) return;
      const nw = { lat: Number(change.new_lat), lng: Number(change.new_lng) };
      const map = new g.maps.Map(ref.current, { center: nw, zoom: 16, disableDefaultUI: true, zoomControl: true });
      new g.maps.Marker({ position: nw, map, title: 'Nova localização', label: 'N' });
      if (change.old_lat != null && change.old_lng != null) {
        const old = { lat: Number(change.old_lat), lng: Number(change.old_lng) };
        new g.maps.Marker({ position: old, map, title: 'Localização anterior', label: 'A', opacity: 0.6 });
        const b = new g.maps.LatLngBounds(); b.extend(old); b.extend(nw); map.fitBounds(b, 60);
      }
    }).catch((e) => setErr(e.message));
    return () => { cancelled = true; };
  }, [change.id]);
  if (err) return <p className="text-xs text-destructive">{err}</p>;
  return <div ref={ref} className="h-72 w-full rounded-md border bg-muted" />;
}

function GeoChangesDashboard({ storeId }: { storeId: string }) {
  const [days, setDays] = useState(90);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<GeoChange | null>(null);
  const sinceIso = useMemo(() => new Date(Date.now() - days * 86400000).toISOString(), [days]);
  const { data = [], isLoading } = useGeoChanges(storeId, sinceIso);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return data;
    return data.filter((r) => [r.seller_name, r.seller_code, r.customer_name, r.customer_code, r.old_address, r.new_address].some((x) => (x || '').toLowerCase().includes(t)));
  }, [data, q]);
  return (
    <Card className="p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {[30, 60, 90, 365].map((d) => (
          <Button key={d} size="sm" variant={days === d ? 'default' : 'outline'} onClick={() => setDays(d)}>{d} dias</Button>
        ))}
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar vendedor, cliente, endereço..." className="max-w-xs" />
        <span className="text-xs text-muted-foreground">{rows.length} alteração(ões)</span>
      </div>
      {isLoading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div> : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhuma alteração de localização no período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b text-left">
              <th className="p-2">Data</th><th className="p-2">Vendedor</th><th className="p-2">Cliente</th>
              <th className="p-2">Endereço atual (anterior)</th><th className="p-2">Novo endereço</th><th className="p-2">Distância</th><th className="p-2">Justificativa</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => setSel(r)}>
                  <td className="p-2 whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                  <td className="p-2">{r.seller_name || '—'}{r.seller_code ? ` (${r.seller_code})` : ''}</td>
                  <td className="p-2">{r.customer_code ? `${r.customer_code} · ` : ''}{r.customer_name}</td>
                  <td className="p-2">{r.old_address || '—'}</td>
                  <td className="p-2">{r.new_address || `${Number(r.new_lat).toFixed(5)}, ${Number(r.new_lng).toFixed(5)}`}</td>
                  <td className="p-2 whitespace-nowrap">{r.distance_meters != null ? `${Math.round(Number(r.distance_meters))} m` : '—'}</td>
                  <td className="p-2">{r.reason}{r.notes ? ` — ${r.notes}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{sel?.customer_name}</DialogTitle></DialogHeader>
          {sel && (
            <div className="space-y-2 text-sm">
              <CompareMap change={sel} />
              <p><b>A — Anterior:</b> {sel.old_address || '—'}</p>
              <p><b>N — Nova:</b> {sel.new_address || `${sel.new_lat}, ${sel.new_lng}`}</p>
              <p className="text-xs text-muted-foreground">Vendedor: {sel.seller_name || '—'} · {formatDateTime(sel.created_at)} · {sel.reason}{sel.notes ? ` — ${sel.notes}` : ''}</p>
              <a className="text-primary underline text-xs" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${sel.new_lat},${sel.new_lng}`}>Abrir nova localização no Google Maps</a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}