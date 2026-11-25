import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export async function readAndroidLocation(options: PositionOptions): Promise<{ lat: number; lng: number }> {
  if (!Capacitor.isPluginAvailable('Geolocation')) {
    throw new Error('Instale a nova versão do APK para usar a localização nativa.');
  }
  let permissions = await Geolocation.checkPermissions();
  if (permissions.location !== 'granted' && permissions.coarseLocation !== 'granted') {
    permissions = await Geolocation.requestPermissions({ permissions: ['location'] });
  }
  if (permissions.location !== 'granted' && permissions.coarseLocation !== 'granted') {
    throw Object.assign(new Error('Permita a localização nas configurações do aplicativo.'), { code: 'OS-PLUG-GLOC-0003' });
  }
  const position = await Geolocation.getCurrentPosition({
    ...options,
    enableHighAccuracy: permissions.location === 'granted' && options.enableHighAccuracy,
  });
  return { lat: position.coords.latitude, lng: position.coords.longitude };
}