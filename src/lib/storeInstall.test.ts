import { describe, expect, it } from 'vitest';
import { installOptions, validApkUrl } from './storeInstall';

const android = 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile';
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1';
const windows = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130';
const base = { slug: 'dicolore', nativeApp: false, standalone: false, canPrompt: false, apkUrl: 'https://exemplo.com/dicolore.apk' };

describe('instalação na entrada da loja', () => {
  it('Android mostra o APK e o atalho quando o navegador oferece', () => {
    expect(installOptions({ ...base, userAgent: android, canPrompt: true })).toEqual(['apk', 'prompt']);
  });
  it('Android sem link de APK mostra só as instruções do atalho', () => {
    expect(installOptions({ ...base, userAgent: android, apkUrl: '' })).toEqual(['android-guide']);
  });
  it('iPhone mostra só o passo a passo, nunca o APK', () => {
    expect(installOptions({ ...base, userAgent: iphone, canPrompt: true })).toEqual(['ios-guide']);
  });
  it('computador mostra o atalho ou as instruções, nunca o APK', () => {
    expect(installOptions({ ...base, userAgent: windows, canPrompt: true })).toEqual(['prompt']);
    expect(installOptions({ ...base, userAgent: windows })).toEqual(['desktop-guide']);
  });
  it('não aparece no APK, no atalho já instalado nem em outras lojas', () => {
    expect(installOptions({ ...base, userAgent: android, nativeApp: true })).toEqual([]);
    expect(installOptions({ ...base, userAgent: android, standalone: true })).toEqual([]);
    expect(installOptions({ ...base, userAgent: android, slug: 'jewos', canPrompt: true })).toEqual([]);
  });
  it('aceita somente link https de arquivo .apk', () => {
    expect(validApkUrl('https://exemplo.com/app.apk')).toBe('https://exemplo.com/app.apk');
    expect(validApkUrl('http://exemplo.com/app.apk')).toBeNull();
    expect(validApkUrl('https://exemplo.com/app.exe')).toBeNull();
  });
});
