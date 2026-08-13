import { useEffect } from 'react';

interface Props {
  /** Nome exibido no ícone da tela inicial */
  name: string;
  shortName?: string;
  /** Caminho que o app deve abrir ao ser aberto pelo ícone (ex: /dicoloresenses/admin) */
  startUrl: string;
  /** Escopo de navegação (padrão: o próprio startUrl base) */
  scope?: string;
  icon?: string | null;
  themeColor?: string;
  description?: string;
}

const FALLBACK_ICON = '/meupedidonozap.png';

/**
 * Injeta em runtime um manifesto específico da página atual, para que
 * "Adicionar à Tela de Início" (iOS) / "Instalar app" (Android) crie um
 * atalho que abre exatamente esta loja/painel — e não a home da plataforma.
 */
export default function DynamicManifest({
  name,
  shortName,
  startUrl,
  scope,
  icon,
  themeColor = '#0f172a',
  description,
}: Props) {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const iconUrl = icon || FALLBACK_ICON;
    const manifest = {
      name,
      short_name: (shortName || name).slice(0, 12),
      description: description || name,
      start_url: startUrl,
      scope: scope || startUrl,
      id: startUrl,
      display: 'standalone',
      orientation: 'portrait',
      theme_color: themeColor,
      background_color: '#ffffff',
      icons: [
        { src: iconUrl, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: iconUrl, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: iconUrl, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    };

    const blobUrl = URL.createObjectURL(
      new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }),
    );

    const created: HTMLElement[] = [];
    const previous: Array<{ el: HTMLElement; attr: string; value: string | null }> = [];

    const setTag = (selector: string, create: () => HTMLElement, attr: string, value: string) => {
      let el = document.head.querySelector<HTMLElement>(selector);
      if (el) {
        previous.push({ el, attr, value: el.getAttribute(attr) });
      } else {
        el = create();
        document.head.appendChild(el);
        created.push(el);
      }
      el.setAttribute(attr, value);
    };

    setTag('link[rel="manifest"]', () => {
      const l = document.createElement('link');
      l.setAttribute('rel', 'manifest');
      return l;
    }, 'href', blobUrl);

    setTag('link[rel="apple-touch-icon"]', () => {
      const l = document.createElement('link');
      l.setAttribute('rel', 'apple-touch-icon');
      return l;
    }, 'href', iconUrl);

    setTag('meta[name="apple-mobile-web-app-capable"]', () => {
      const m = document.createElement('meta');
      m.setAttribute('name', 'apple-mobile-web-app-capable');
      return m;
    }, 'content', 'yes');

    setTag('meta[name="mobile-web-app-capable"]', () => {
      const m = document.createElement('meta');
      m.setAttribute('name', 'mobile-web-app-capable');
      return m;
    }, 'content', 'yes');

    setTag('meta[name="apple-mobile-web-app-title"]', () => {
      const m = document.createElement('meta');
      m.setAttribute('name', 'apple-mobile-web-app-title');
      return m;
    }, 'content', (shortName || name).slice(0, 30));

    setTag('meta[name="apple-mobile-web-app-status-bar-style"]', () => {
      const m = document.createElement('meta');
      m.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
      return m;
    }, 'content', 'black-translucent');

    setTag('meta[name="theme-color"]', () => {
      const m = document.createElement('meta');
      m.setAttribute('name', 'theme-color');
      return m;
    }, 'content', themeColor);

    return () => {
      created.forEach((el) => el.remove());
      previous.forEach(({ el, attr, value }) => {
        if (value === null) el.removeAttribute(attr);
        else el.setAttribute(attr, value);
      });
      URL.revokeObjectURL(blobUrl);
    };
  }, [name, shortName, startUrl, scope, icon, themeColor, description]);

  return null;
}
