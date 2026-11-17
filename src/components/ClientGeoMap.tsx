import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import Supercluster from 'supercluster';
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { stageColors } from '@/lib/clientMap';
import type { LifecycleStage } from '@/lib/clientLifecycle';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';

export interface ClientGeoPoint { code: string; name: string; city: string; neighborhood: string; seller: string; stage: LifecycleStage; lat: number; lng: number; precision: string; last: string | null; daysSince: number | null; revenue: number; ticket: number }
type Props = { points: ClientGeoPoint[]; onSelect: (code: string) => void };
function Points({ points, onSelect }: Props) {
  const map = useMap();
  const [view, setView] = useState(0);
  useMapEvents({ moveend: () => setView(v => v + 1), zoomend: () => setView(v => v + 1) });
  const index = useMemo(() => new Supercluster<{ point: ClientGeoPoint }>({ radius: 45, maxZoom: 18 }).load(points.map(point => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [point.lng, point.lat] }, properties: { point } }))), [points]);
  useEffect(() => {
    map.invalidateSize();
    if (points.length) map.fitBounds(L.latLngBounds(points.map(p => [p.lat, p.lng])), { padding: [30, 30], maxZoom: 13 });
    else map.fitBounds([[-29.4, -53.8], [-25.9, -48.3]]);
    const observer = new ResizeObserver(() => map.invalidateSize()); observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, points]);
  const clusters = useMemo(() => { const b = map.getBounds(); return index.getClusters([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], Math.floor(map.getZoom())); }, [map, index, view]);
  return <>{clusters.map(feature => {
    const [lng, lat] = feature.geometry.coordinates;
    if ('cluster' in feature.properties && feature.properties.cluster) {
      const id = feature.properties.cluster_id, count = feature.properties.point_count;
      return <CircleMarker key={`cluster-${id}`} center={[lat, lng]} radius={Math.min(26, 12 + Math.log2(count))} pathOptions={{ color: 'hsl(var(--primary))', fillColor: 'hsl(var(--background))', fillOpacity: 0.95, weight: 3 }} eventHandlers={{ click: () => map.setView([lat, lng], Math.min(19, index.getClusterExpansionZoom(id))) }}><Popup><div className="space-y-2"><strong>{count} clientes nesta área</strong><p className="text-xs">{index.getLeaves(id, Infinity).reduce<Record<string, number>>((a, f) => { const s = f.properties.point.stage; a[s] = (a[s] || 0) + 1; return a; }, {}) && Object.entries(index.getLeaves(id, Infinity).reduce<Record<string, number>>((a, f) => { const s = f.properties.point.stage; a[s] = (a[s] || 0) + 1; return a; }, {})).map(([s, n]) => `${s}: ${n}`).join(' • ')}</p></div></Popup></CircleMarker>;
    }
    const p = feature.properties.point;
    if (!p) return null;
    return <CircleMarker key={p.code} center={[lat, lng]} radius={7} pathOptions={{ color: stageColors[p.stage], fillColor: stageColors[p.stage], fillOpacity: 0.85, weight: 2 }}><Popup><div className="min-w-48 space-y-1"><strong>{p.code} — {p.name}</strong><div>{p.neighborhood || 'Bairro não informado'} • {p.city}/SC</div><div>{p.stage}</div><div>{p.seller}</div><div>Última compra: {p.last?.split('-').reverse().join('/') || 'Sem histórico'}</div><div>Dias sem comprar: {p.daysSince ?? '—'}</div><div>Faturado: {formatCurrency(p.revenue)}</div><div>Ticket: {formatCurrency(p.ticket)}</div><div className="text-xs">{p.precision}</div><Button size="sm" variant="outline" onClick={() => onSelect(p.code)}>Ver cliente</Button></div></Popup></CircleMarker>;
  })}</>;
}
export default function ClientGeoMap(props: Props) {
  return <MapContainer center={[-27.2, -50.7]} zoom={7} className="h-[480px] w-full rounded-md z-0 sm:h-[540px]" scrollWheelZoom><TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" /><Points {...props} /></MapContainer>;
}