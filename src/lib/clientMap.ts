import municipalities from './scMunicipalities.json';
import type { CA_Customer } from './clientAnalytics';
import type { LifecycleStage } from './clientLifecycle';

export interface GeoCustomer extends CA_Customer { neighborhood: string; lat: number | null; lng: number | null; municipality: string }
export const normalizePlace = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
const cities = new Map(municipalities.map(c => [normalizePlace(c.name), c]));
const codes = new Map(municipalities.map(c => [c.code, c]));
export function locateClient(c: GeoCustomer) {
  if (normalizePlace(c.uf) !== 'SC') return null;
  if (c.lat !== null && c.lng !== null && Number.isFinite(c.lat) && Number.isFinite(c.lng) && c.lat >= -29.5 && c.lat <= -25.8 && c.lng >= -53.9 && c.lng <= -48.2) return { lat: c.lat, lng: c.lng, precision: 'Coordenada cadastrada' as const };
  const city = codes.get(c.municipality) || cities.get(normalizePlace(c.city));
  return city ? { lat: city.lat, lng: city.lng, precision: 'Referência municipal aproximada' as const } : null;
}
export const stageColors: Record<LifecycleStage, string> = {
  Recorrente: 'hsl(var(--success))', Desacelerando: 'hsl(var(--warning))', 'Em risco': 'hsl(var(--destructive))',
  'Inativo crítico': 'hsl(var(--map-critical))', Reativado: 'hsl(var(--info))',
  'Primeira compra observada': 'hsl(var(--map-new))', 'Compra única': 'hsl(var(--map-single))',
  'Sem compras no histórico disponível': 'hsl(var(--muted-foreground))',
};