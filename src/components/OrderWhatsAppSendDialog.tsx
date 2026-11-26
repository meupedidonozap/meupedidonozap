import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { watchWhatsAppLaunch } from '@/lib/whatsAppLaunch';

type Props = { pending: { url: string; sellerName: string } | null; onFinish: () => void };

/** DiColore: the order is already saved; keeps the customer on the WhatsApp step until it is sent or given up. */
export default function OrderWhatsAppSendDialog({ pending, onFinish }: Props) {
  const [attempted, setAttempted] = useState(false);
  const [askAbort, setAskAbort] = useState(false);
  const stopWatch = useRef<(() => void) | null>(null);
  useEffect(() => () => stopWatch.current?.(), []);
  useEffect(() => { if (!pending) { stopWatch.current?.(); setAttempted(false); setAskAbort(false); } }, [pending]);

  // Runs on the tap itself: the link opens WhatsApp, and the abort question shows only if the page never left.
  const launch = () => {
    stopWatch.current?.();
    stopWatch.current = watchWhatsAppLaunch(() => setAskAbort(true));
    setAttempted(true);
    setAskAbort(false);
  };
  const finish = () => { stopWatch.current?.(); onFinish(); };
  const link = (label: string) => (
    <a href={pending?.url} target="_blank" rel="noopener noreferrer" onClick={launch}>
      <MessageCircle className="h-4 w-4" /> {label}
    </a>
  );

  return <>
    <Dialog open={!!pending} onOpenChange={open => { if (!open) setAskAbort(true); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Pedido salvo!</DialogTitle>
          <DialogDescription>
            Seu pedido está SALVO, mas o envio da mensagem pelo WhatsApp é fundamental para {pending?.sellerName} receber e dar andamento. Toque no botão abaixo para enviar.
          </DialogDescription>
        </DialogHeader>
        <Button asChild size="lg" className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
          {link(attempted ? 'Abrir WhatsApp novamente' : `Abrir WhatsApp de ${pending?.sellerName ?? ''}`)}
        </Button>
        <Button variant="outline" className="w-full gap-2" onClick={async () => {
          if (!pending) return;
          try { await navigator.clipboard.writeText(new URL(pending.url).searchParams.get('text') || ''); toast.success('Mensagem copiada'); }
          catch { toast.error('Não foi possível copiar a mensagem'); }
        }}><Copy className="h-4 w-4" /> Copiar mensagem</Button>
        {attempted && <Button variant="secondary" className="w-full" onClick={finish}>Já enviei a mensagem</Button>}
      </DialogContent>
    </Dialog>
    <AlertDialog open={!!pending && askAbort} onOpenChange={open => { if (!open) setAskAbort(false); }}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Deseja abortar o envio?</AlertDialogTitle>
          <AlertDialogDescription>Seu pedido já foi transmitido e poderá acompanhar em "Meus Pedidos".</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <Button variant="outline" onClick={finish}>Sim</Button>
          <Button asChild className="gap-2">{link('Não, abrir o WhatsApp')}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
