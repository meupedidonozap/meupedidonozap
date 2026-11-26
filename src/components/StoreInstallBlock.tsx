import { useEffect, useState } from 'react';
import { Download, MonitorDown, Share, Smartphone, SquarePlus } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { installOptions, validApkUrl } from '@/lib/storeInstall';
import apkAsset from '@/assets/dicolore.apk.asset.json';
import type { Store } from '@/types';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Instalação na entrada da loja (somente DiColore): APK no Android, atalho no navegador, guia no iPhone. */
export default function StoreInstallBlock({ store }: { store: Store }) {
  const isDicolore = store.slug === 'dicolore';
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [guide, setGuide] = useState<'ios' | 'android' | 'desktop' | null>(null);

  useEffect(() => {
    if (!isDicolore) return;
    const onPrompt = (event: Event) => { event.preventDefault(); setPromptEvent(event as InstallPromptEvent); };
    const onInstalled = () => { setInstalled(true); setPromptEvent(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [isDicolore]);

  if (!isDicolore || installed) return null;
  // Link das configurações da loja tem prioridade; sem ele, usa o APK hospedado junto com o sistema.
  const apkUrl = validApkUrl((store.settings as any)?.androidApkUrl) || apkAsset.url;
  const options = installOptions({
    slug: store.slug,
    userAgent: navigator.userAgent,
    nativeApp: Capacitor.isNativePlatform(),
    standalone: window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true,
    canPrompt: !!promptEvent,
    apkUrl,
    touchPoints: navigator.maxTouchPoints,
  });
  if (!options.length) return null;

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setPromptEvent(null);
  };

  return (
    <div className="mt-6 border-t pt-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Use como aplicativo</p>
      <div className="space-y-2">
        {options.includes('apk') && apkUrl && (
          <Button asChild variant="outline" className="w-full">
            <a href={apkUrl} download><Smartphone className="mr-2 h-4 w-4" />Baixar APK para Android</a>
          </Button>
        )}
        {options.includes('prompt') && (
          <Button variant="outline" className="w-full" onClick={install}><Download className="mr-2 h-4 w-4" />Instalar atalho</Button>
        )}
        {options.includes('ios-guide') && (
          <Button variant="outline" className="w-full" onClick={() => setGuide('ios')}><SquarePlus className="mr-2 h-4 w-4" />Adicionar à Tela de Início</Button>
        )}
        {options.includes('android-guide') && (
          <Button variant="outline" className="w-full" onClick={() => setGuide('android')}><SquarePlus className="mr-2 h-4 w-4" />Adicionar à tela inicial</Button>
        )}
        {options.includes('desktop-guide') && (
          <Button variant="outline" className="w-full" onClick={() => setGuide('desktop')}><MonitorDown className="mr-2 h-4 w-4" />Criar atalho neste computador</Button>
        )}
      </div>
      <Dialog open={!!guide} onOpenChange={(value) => !value && setGuide(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{guide === 'ios' ? 'Adicionar à Tela de Início' : guide === 'android' ? 'Adicionar à tela inicial' : 'Criar atalho'}</DialogTitle>
            <DialogDescription>Depois de criado, o atalho abre a {store.name} direto, sempre com os dados atualizados.</DialogDescription>
          </DialogHeader>
          {guide === 'ios' ? (
            <ol className="list-decimal space-y-3 pl-5 text-sm">
              <li>Abra esta página no <strong>Safari</strong>.</li>
              <li>Toque em <Share className="inline h-4 w-4" /> <strong>Compartilhar</strong>, na barra do navegador.</li>
              <li>Role e toque em <SquarePlus className="inline h-4 w-4" /> <strong>Adicionar à Tela de Início</strong>.</li>
              <li>Confirme em <strong>Adicionar</strong>.</li>
            </ol>
          ) : guide === 'android' ? (
            <ol className="list-decimal space-y-3 pl-5 text-sm">
              <li>Toque no menu <strong>⋮</strong> do navegador (no Firefox, <strong>⋮ → Mais</strong>).</li>
              <li>Toque em <strong>Adicionar à tela inicial</strong> ou <strong>Instalar app</strong>.</li>
              <li>Confirme em <strong>Adicionar</strong>.</li>
            </ol>
          ) : (
            <ol className="list-decimal space-y-3 pl-5 text-sm">
              <li><strong>Chrome ou Edge:</strong> abra o menu (⋮ ou ⋯) e escolha <strong>Transmitir, salvar e compartilhar → Instalar página como app</strong> (no Edge: <strong>Aplicativos → Instalar este site</strong>).</li>
              <li><strong>Firefox:</strong> arraste o cadeado da barra de endereço para a área de trabalho.</li>
              <li><strong>Safari no Mac:</strong> menu <strong>Arquivo → Adicionar ao Dock</strong>.</li>
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
