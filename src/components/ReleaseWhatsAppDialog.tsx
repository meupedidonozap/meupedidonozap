import { useEffect, useState } from 'react';
import { MessageCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { RELEASE_WHATSAPP_EVENT, releaseAppUrl, type ReleaseMessage } from '@/lib/releaseWhatsApp';

export default function ReleaseWhatsAppDialog() {
  const [message, setMessage] = useState<ReleaseMessage | null>(null);
  useEffect(() => {
    const receive = (event: Event) => setMessage((event as CustomEvent<ReleaseMessage>).detail);
    window.addEventListener(RELEASE_WHATSAPP_EVENT, receive);
    return () => window.removeEventListener(RELEASE_WHATSAPP_EVENT, receive);
  }, []);
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const openNative = async () => {
    if (!message) return;
    try {
      const result = await AppLauncher.openUrl({ url: releaseAppUrl(message.url) });
      if (!result.completed) toast.error('Não foi possível abrir o WhatsApp. Copie a mensagem.');
    } catch { toast.error('Não foi possível abrir o WhatsApp. Copie a mensagem.'); }
  };
  return <Dialog open={!!message} onOpenChange={open => { if (!open) setMessage(null); }}>
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Pedido liberado para transmissão</DialogTitle><DialogDescription>Deseja enviar o aviso pelo WhatsApp?</DialogDescription></DialogHeader>
      <DialogFooter className="flex-wrap gap-2">
        <Button variant="outline" onClick={() => setMessage(null)}>Agora não</Button>
        <Button variant="outline" onClick={async () => {
          if (!message) return;
          try { await navigator.clipboard.writeText(new URL(message.url).searchParams.get('text') || ''); toast.success('Mensagem copiada'); }
          catch { toast.error('Não foi possível copiar a mensagem'); }
        }}><Copy className="mr-2 h-4 w-4" />Copiar mensagem</Button>
        {Capacitor.isNativePlatform() ? <Button onClick={openNative}><MessageCircle className="mr-2 h-4 w-4" />Abrir WhatsApp</Button> :
          <Button asChild><a href={message ? (mobile ? releaseAppUrl(message.url) : message.url) : undefined} target={mobile ? undefined : '_blank'} rel="noopener noreferrer"><MessageCircle className="mr-2 h-4 w-4" />Abrir WhatsApp</a></Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}