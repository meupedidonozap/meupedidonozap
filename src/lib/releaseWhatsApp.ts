export const RELEASE_WHATSAPP_EVENT = 'mpz:release-whatsapp';
export type ReleaseMessage = { url: string };

export function requestReleaseWhatsApp(slug: string | undefined, url: string, legacyWindow: Window | null = null) {
  if (slug === 'dicolore') {
    legacyWindow?.close();
    window.dispatchEvent(new CustomEvent<ReleaseMessage>(RELEASE_WHATSAPP_EVENT, { detail: { url } }));
  } else if (legacyWindow) {
    legacyWindow.opener = null;
    legacyWindow.location.href = url;
  } else {
    window.location.href = url;
  }
}

export function releaseAppUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.origin !== 'https://wa.me' || !/^\/\d+$/.test(parsed.pathname)) throw new Error('Link de WhatsApp inválido');
  return `whatsapp://send?phone=${parsed.pathname.slice(1)}&text=${encodeURIComponent(parsed.searchParams.get('text') || '')}`;
}

export function storeBackPath(slug: string | undefined) {
  return slug === 'dicolore' ? '/dicolore' : '/admin';
}