import { useEffect, useState } from 'react';
import { Download, Share, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  /** O que será instalado, ex.: "o painel da DiColore Senses" */
  label: string;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);
}

/**
 * Explica como adicionar o app à tela inicial (iOS) ou instalar (Android).
 * Some quando o app já está aberto em modo instalado.
 */
export default function InstallAppCard({ label }: Props) {
  const [prompt, setPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  const ios = isIOS();

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-start gap-3">
          <Smartphone className="mt-0.5 h-5 w-5 text-primary" />
          <div className="flex-1">
            <div className="text-sm font-semibold">Instalar {label} no celular</div>
            <div className="text-xs text-muted-foreground">
              {ios ? (
                <>
                  No iPhone: toque em <Share className="inline h-3 w-3" /> <strong>Compartilhar</strong> na barra do
                  Safari e escolha <strong>Adicionar à Tela de Início</strong>. Abra sempre por esse ícone — as
                  notificações de novos pedidos no iPhone só funcionam com o app instalado.
                </>
              ) : (
                <>
                  No Android: use <strong>Instalar aplicativo</strong> no menu do navegador (ou o botão ao lado).
                  Assim esta página abre direto pelo ícone, com notificações ativas.
                </>
              )}
            </div>
          </div>
        </div>
        {!ios && prompt && (
          <Button
            size="sm"
            onClick={async () => {
              try {
                prompt.prompt();
                await prompt.userChoice;
              } catch { /* ignore */ }
              setPrompt(null);
            }}
          >
            <Download className="mr-1 h-4 w-4" /> Instalar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
