// Haversine distance between two lat/lng points, in meters.
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface Coords {
  lat: number;
  lng: number;
}

export type GeoErrorKind = 'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'insecure';

export class GeoError extends Error {
  kind: GeoErrorKind;
  constructor(kind: GeoErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

function readPosition(options: PositionOptions): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      reject(new GeoError('insecure', 'A localização só funciona em endereço seguro (https).'));
      return;
    }
    if (!('geolocation' in navigator)) {
      reject(new GeoError('unsupported', 'Geolocalização não suportada neste navegador.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        const kind: GeoErrorKind = err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable';
        reject(new GeoError(kind, err.message || 'Falha ao obter localização.'));
      },
      options,
    );
  });
}

export async function getCurrentPosition(options?: PositionOptions): Promise<Coords> {
  // 1ª tentativa: GPS de alta precisão (melhor no celular, ao ar livre).
  try {
    return await readPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0, ...(options || {}) });
  } catch (e) {
    // Permissão negada: não adianta tentar de novo.
    if (e instanceof GeoError && (e.kind === 'denied' || e.kind === 'unsupported' || e.kind === 'insecure')) throw e;
    // 2ª tentativa: posição aproximada por rede/Wi-Fi (rápida, funciona em ambiente fechado).
    return await readPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 300000, ...(options || {}) });
  }
}


let mapsLoader: Promise<any> | null = null;
let mapsAuthFailed = false;
const authFailureListeners = new Set<() => void>();

export function isGoogleMapsAuthFailed(): boolean {
  return mapsAuthFailed;
}

export function onGoogleMapsAuthFailure(cb: () => void): () => void {
  authFailureListeners.add(cb);
  if (mapsAuthFailed) cb();
  return () => authFailureListeners.delete(cb);
}

export function loadGoogleMaps(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  if ((window as any).google?.maps) return Promise.resolve((window as any).google);
  if (mapsLoader) return mapsLoader;
  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
  if (!key) return Promise.reject(new Error('Google Maps não configurado.'));
  (window as any).gm_authFailure = () => {
    mapsAuthFailed = true;
    authFailureListeners.forEach((cb) => {
      try { cb(); } catch {}
    });
  };
  mapsLoader = new Promise((resolve, reject) => {
    const cbName = '__lovableInitGmaps';
    (window as any)[cbName] = () => resolve((window as any).google);
    const script = document.createElement('script');
    const params = new URLSearchParams({
      key,
      loading: 'async',
      callback: cbName,
      libraries: 'places',
    });
    if (channel) params.set('channel', channel);
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => reject(new Error('Falha ao carregar Google Maps.'));
    document.head.appendChild(script);
  });
  return mapsLoader;
}