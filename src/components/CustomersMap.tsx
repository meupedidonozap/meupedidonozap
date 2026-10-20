import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { useEffect } from 'react';

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  /** pending = sem visita no período; visited = visitado; open = visita em andamento */
  status: 'pending' | 'visited' | 'open';
}

const COLORS: Record<MapPoint['status'], string> = {
  pending: 'hsl(var(--destructive))',
  visited: 'hsl(142 70% 40%)',
  open: 'hsl(217 90% 55%)',
};

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const b = L.latLngBounds(points.map(p => [p.lat, p.lng] as [number, number]));
    map.fitBounds(b, { padding: [30, 30], maxZoom: 15 });
  }, [points, map]);
  return null;
}

export default function CustomersMap({
  points, renderActions,
}: { points: MapPoint[]; renderActions?: (id: string) => React.ReactNode }) {
  return (
    <MapContainer center={[-27.1, -48.9]} zoom={8} className="h-full w-full rounded-md z-0" scrollWheelZoom>
      <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitBounds points={points} />
      {points.map(p => (
        <CircleMarker
          key={p.id}
          center={[p.lat, p.lng]}
          radius={8}
          pathOptions={{ color: COLORS[p.status], fillColor: COLORS[p.status], fillOpacity: 0.85, weight: 2 }}
        >
          <Popup>
            <div className="space-y-1 min-w-[180px]">
              <p className="font-semibold text-sm">{p.title}</p>
              {p.subtitle && <p className="text-xs">{p.subtitle}</p>}
              {renderActions?.(p.id)}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
