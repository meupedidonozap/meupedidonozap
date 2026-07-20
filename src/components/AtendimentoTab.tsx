import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MapPin, LogIn as LogInIcon, LogOut as LogOutIcon, Navigation, Search, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDateTime } from '@/lib/formatters';
import { haversineMeters, getCurrentPosition, loadGoogleMaps } from '@/lib/geo';
import { useCheckIn, useCheckOut, useCustomerVisits, geocodeAddress, saveCustomerGeo, type CustomerVisit } from '@/hooks/useCustomerVisits';

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
        .select('id, name, whatsapp, address, number, neighborhood, city, uf, cep, seller_code, geo_lat, geo_lng, is_active')
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

function MiniMap({ customer, sellerCoords }: { customer: CustomerRow; sellerCoords: { lat: number; lng: number } | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
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
        new g.maps.Marker({ position: center, map, title: customer.name });
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
    };
  }, [customer.id, customer.geo_lat, customer.geo_lng, sellerCoords?.lat, sellerCoords?.lng]);

  if (err) return <div className="text-xs text-destructive">Mapa indisponível: {err}</div>;
  return <div ref={ref} className="h-56 w-full rounded-md border bg-muted" />;
}

export default function AtendimentoTab({ storeId, sellerCodes, isAdmin }: { storeId: string; sellerCodes: string[]; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sellerCoords, setSellerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [geocodingId, setGeocodingId] = useState<string | null>(null);

  const { data: customers = [], isLoading, refetch } = useSellerCustomers(storeId, isAdmin ? [] : sellerCodes);
  const { data: visits = [] } = useCustomerVisits(storeId, {
    onlyMine: !isAdmin,
    sinceIso: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
  });

  const checkIn = useCheckIn();
  const checkOut = useCheckOut();

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q) ||
        (c.city || '').toLowerCase().includes(q) ||
        (c.whatsapp || '').includes(q),
    );
  }, [customers, search]);

  const selected = customers.find((c) => c.id === selectedId) || null;

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
    if (!geo) return;
    const my = sellerCoords ?? (await acquireLocation());
    if (!my) return;
    const dist = haversineMeters(my.lat, my.lng, geo.lat, geo.lng);
    if (dist > MAX_CHECKIN_METERS) {
      toast.error(`Muito longe do cliente (${Math.round(dist)}m). Máx.: ${MAX_CHECKIN_METERS}m.`);
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

  async function handleCheckOut(visit: CustomerVisit) {
    const my = await acquireLocation();
    if (!my) return;
    try {
      await checkOut.mutateAsync({ visitId: visit.id, lat: my.lat, lng: my.lng });
      toast.success('Check-out registrado.');
    } catch (e: any) {
      toast.error(e.message || 'Falha ao registrar check-out.');
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      {/* Lista */}
      <Card className="p-3 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente, endereço, cidade..."
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
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left rounded-md border p-2 transition ${active ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        <MapPin className="inline h-3 w-3 mr-1" />
                        {c.address}{c.number ? `, ${c.number}` : ''} · {c.neighborhood} · {c.city}/{c.uf}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {openVisit && <Badge className="bg-green-600">Em atendimento</Badge>}
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
              <h3 className="font-semibold text-lg">{selected.name}</h3>
              <p className="text-sm text-muted-foreground">{fullAddress(selected)}</p>
              {selected.whatsapp && <p className="text-xs text-muted-foreground">WhatsApp: {selected.whatsapp}</p>}
            </div>

            {selected.geo_lat == null || selected.geo_lng == null ? (
              <div className="rounded-md border p-3 space-y-2 bg-muted/30">
                <p className="text-sm">Endereço ainda não localizado no mapa.</p>
                <Button
                  size="sm"
                  onClick={() => ensureCustomerGeo(selected)}
                  disabled={geocodingId === selected.id}
                >
                  {geocodingId === selected.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MapPin className="h-4 w-4 mr-2" />}
                  Localizar endereço
                </Button>
              </div>
            ) : (
              <MiniMap customer={selected} sellerCoords={sellerCoords} />
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
                      <li key={v.id} className="flex justify-between gap-2">
                        <span>{formatDateTime(v.checked_in_at)}</span>
                        <span className="text-muted-foreground">
                          {v.checked_out_at ? `→ ${formatDateTime(v.checked_out_at)}` : 'em aberto'}
                          {v.distance_meters_at_checkin != null && ` · ${v.distance_meters_at_checkin}m`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}
          </div>
        )}
      </Card>
    </div>
  );
}