import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Copy, MessageCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/formatters';

export interface PixDialogData { payload: string; amount: number; orderNumber?: number; whatsappUrl: string; orderId?: string; qrImage?: string }

export function PixPaymentDialog({ data, onClose }: { data: PixDialogData | null; onClose: () => void }) {
  const [paid, setPaid] = useState(false);
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    setPaid(false); setSecs(0);
    if (!data?.orderId) return;
    const tick = setInterval(() => setSecs(s => s + 1), 1000);
    const t = setInterval(async () => {
      const { data: r } = await supabase.functions.invoke('mercadopago', { body: { action: 'status', orderId: data.orderId } });
      if (r?.paymentStatus === 'paid') { setPaid(true); clearInterval(t); clearInterval(tick); }
    }, 4000);
    return () => { clearInterval(t); clearInterval(tick); };
  }, [data?.orderId]);

  const close = () => {
    if (data?.orderId && !paid) toast.info('Seu pedido ficou aguardando pagamento — você pode pagar em Meus Pedidos.');
    onClose();
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(data!.payload); toast.success('Código PIX copiado!'); }
    catch { toast.error('Não foi possível copiar. Selecione o código e copie manualmente.'); }
  };
  const waConfirmed = data ? data.whatsappUrl.replace(/([?&]text=)/, `$1${encodeURIComponent(`✅ Pagamento confirmado via PIX${data.orderNumber ? ` (Pedido #${data.orderNumber})` : ''}\n\n`)}`) : '#';
  const mm = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

  return (
    <Dialog open={!!data} onOpenChange={v => { if (!v) close(); }}>
      <DialogContent className="max-w-sm">
        {data && paid ? (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle2 className="mx-auto h-16 w-16 text-primary" />
            <DialogTitle className="text-xl">Pagamento confirmado!</DialogTitle>
            <DialogDescription>Pedido{data.orderNumber ? ` #${data.orderNumber}` : ''} PAGO · {formatCurrency(data.amount)}</DialogDescription>
            <Button asChild className="w-full gap-2"><a href={waConfirmed} target="_blank" rel="noopener noreferrer" onClick={onClose}><MessageCircle className="h-4 w-4" /> Enviar pedido no WhatsApp</a></Button>
            <Button variant="ghost" className="w-full" onClick={onClose}>Fechar</Button>
          </div>
        ) : data && (
          <>
            <DialogHeader>
              <DialogTitle>Pague com PIX{data.orderNumber ? ` · Pedido #${data.orderNumber}` : ''}</DialogTitle>
              <DialogDescription>Valor: <strong>{formatCurrency(data.amount)}</strong>. Aponte a câmera do app do banco ou use o copia e cola.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex justify-center rounded-md bg-card p-3">{data.qrImage ? <img src={`data:image/png;base64,${data.qrImage}`} alt="QR Code PIX" className="h-[220px] w-[220px]" /> : <QRCodeSVG value={data.payload} size={220} />}</div>
              <textarea readOnly value={data.payload} className="h-20 w-full resize-none rounded-md border bg-muted p-2 text-[10px]" onFocus={e => e.currentTarget.select()} />
              <Button className="w-full gap-2" onClick={copy}><Copy className="h-4 w-4" /> Copiar código PIX</Button>
              {data.orderId ? (
                <p className="flex items-center justify-center gap-2 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Aguardando pagamento... {mm}</p>
              ) : (
                <Button asChild variant="outline" className="w-full gap-2">
                  <a href={data.whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={onClose}><MessageCircle className="h-4 w-4" /> Já paguei — enviar pedido</a>
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
