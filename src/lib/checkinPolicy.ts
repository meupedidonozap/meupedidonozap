import { haversineMeters } from './geo';

type Point = { lat: number; lng: number };

export function checkinPolicy(slug: string, radius = 300) {
  return { fixesPoint: slug === 'dicolore', radius };
}

export function checkinDistance(point: Point, reference: Point | null) {
  return reference ? haversineMeters(point.lat, point.lng, reference.lat, reference.lng) : 0;
}

export type CheckinDecision =
  | { kind: 'confirm-first-point' }
  | { kind: 'allowed'; distance: number }
  | { kind: 'blocked'; distance: number };

/**
 * DiColore: sem ponto salvo, o usuário confirma a coordenada que será gravada;
 * com ponto salvo, o check-in acima do raio configurado é bloqueado.
 */
export function checkinDecision(point: Point, reference: Point | null, radius: number): CheckinDecision {
  if (!reference) return { kind: 'confirm-first-point' };
  const distance = haversineMeters(point.lat, point.lng, reference.lat, reference.lng);
  return distance > radius ? { kind: 'blocked', distance } : { kind: 'allowed', distance };
}

export function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}
