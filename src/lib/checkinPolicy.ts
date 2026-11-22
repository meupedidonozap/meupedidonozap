import { haversineMeters } from './geo';

export function checkinPolicy(slug: string, radius = 300) {
  return { fixesPoint: slug === 'dicolore', radius };
}

export function checkinDistance(point: { lat: number; lng: number }, reference: { lat: number; lng: number } | null) {
  return reference ? haversineMeters(point.lat, point.lng, reference.lat, reference.lng) : 0;
}