export type InstallOption = 'apk' | 'prompt' | 'ios-guide' | 'android-guide' | 'desktop-guide';

export interface InstallContext {
  slug: string;
  userAgent: string;
  /** Aberto dentro do APK. */
  nativeApp: boolean;
  /** Já aberto pelo atalho instalado. */
  standalone: boolean;
  /** O navegador ofereceu a instalação (beforeinstallprompt). */
  canPrompt: boolean;
  /** Link já validado pelo chamador. */
  apkUrl?: string | null;
  /** iPadOS se apresenta como Mac; o toque diferencia. */
  touchPoints?: number;
}

/** Só aceita link https terminado em .apk, para o botão nunca apontar para outro tipo de arquivo. */
export function validApkUrl(value?: string | null): string | null {
  const url = String(value || '').trim();
  return /^https:\/\/[^\s]+\.apk(\?[^\s]*)?$/i.test(url) ? url : null;
}

/** O domínio próprio não entrega a rota de arquivos hospedados; o endereço completo baixa em qualquer domínio. */
export const hostedApkUrl = (path: string) => `https://meupedidonozap.lovable.app${path}`;

/** Opções de instalação da entrada da loja; hoje restritas à DiColore. */
export function installOptions(ctx: InstallContext): InstallOption[] {
  if (ctx.slug !== 'dicolore' || ctx.nativeApp || ctx.standalone) return [];
  const ua = ctx.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && (ctx.touchPoints || 0) > 1);
  if (ios) return ['ios-guide'];
  const options: InstallOption[] = [];
  if (/Android/i.test(ua) && ctx.apkUrl) options.push('apk');
  if (ctx.canPrompt) options.push('prompt');
  else options.push(/Android/i.test(ua) ? 'android-guide' : 'desktop-guide');
  return options;
}
