import { Capacitor } from '@capacitor/core';
import { isAndroidApp } from '@/lib/nativeAndroid';

export type WhatsAppTarget = { phone: string; text: string };

/** Accepts only WhatsApp links; anything else keeps normal navigation. */
export function whatsAppTarget(raw: string | null | undefined): WhatsAppTarget | null {
  if (!raw) return null;
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  const text = url.searchParams.get('text') || '';
  if (url.protocol === 'whatsapp:') {
    const phone = (url.searchParams.get('phone') || '').replace(/\D/g, '');
    return phone ? { phone, text } : null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.hostname === 'wa.me') {
    const phone = url.pathname.slice(1);
    return /^\d+$/.test(phone) ? { phone, text } : null;
  }
  if (url.hostname === 'api.whatsapp.com' || url.hostname === 'web.whatsapp.com') {
    const phone = (url.searchParams.get('phone') || '').replace(/\D/g, '');
    return phone ? { phone, text } : null;
  }
  return null;
}

/** The Android WebView cannot hand links to WhatsApp by itself: launch the installed app, then the universal link. */
export async function openWhatsAppNative(raw: string): Promise<boolean> {
  const target = whatsAppTarget(raw);
  if (!target || !isAndroidApp()) return false;
  const query = `phone=${target.phone}&text=${encodeURIComponent(target.text)}`;
  const universal = `https://api.whatsapp.com/send?${query}`;
  if (Capacitor.isPluginAvailable('AppLauncher')) {
    const { AppLauncher } = await import('@capacitor/app-launcher');
    for (const url of [`whatsapp://send?${query}`, universal]) {
      try {
        if ((await AppLauncher.openUrl({ url })).completed) return true;
      } catch { /* Try the next way of opening WhatsApp. */ }
    }
    return false;
  }
  // Older APK without the launcher: an external address leaves the WebView through the system.
  window.location.href = universal;
  return true;
}

/** Routes every WhatsApp link/popup of the APK through the native launcher. */
export function installNativeWhatsAppLinks(onFailure: () => void): () => void {
  if (!isAndroidApp()) return () => undefined;
  const launch = (url: string) => { void openWhatsAppNative(url).then(opened => { if (!opened) onFailure(); }); };
  const onClick = (event: MouseEvent) => {
    const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!anchor || !whatsAppTarget(anchor.href)) return;
    event.preventDefault();
    launch(anchor.href);
  };
  document.addEventListener('click', onClick, true);
  const originalOpen = window.open;
  window.open = function (url?: string | URL, ...rest: any[]) {
    const href = url ? String(url) : '';
    if (whatsAppTarget(href)) { launch(href); return null; }
    return originalOpen.call(window, url as any, ...rest);
  } as typeof window.open;
  return () => { document.removeEventListener('click', onClick, true); window.open = originalOpen; };
}
