import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { Copy, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/formatters';

export interface PixDialogData { payload: string; amount: number; orderNumber?: number; whatsappUrl: string }

export function PixPaymentDialog({ data, onClose }: { data: PixDialogData | null; onClose: () => void }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(data!.payload); toast.success('Código PIX copiado!'); }
    catch { toast.error('Não foi possível copiar. Selecione o código e copie manualmente.'); }
  };
  return (
    <Dialog open={!!data} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Pague com PIX{data?.orderNumber ? ` · Pedido #${data.orderNumber}` : ''}</DialogTitle>
          <DialogDescription>Valor: <strong>{data ? formatCurrency(data.amount) : ''}</strong>. Aponte a câmera do app do banco ou use o copia e cola.</DialogDescription>
        </DialogHeader>
        {data && (
          <div className="space-y-3">
            <div className="flex justify-center rounded-md bg-card p-3"><QRCodeSVG value={data.payload} size={220} /></div>
            <textarea readOnly value={data.payload} className="h-20 w-full resize-none rounded-md border bg-muted p-2 text-[10px]" onFocus={e => e.currentTarget.select()} />
            <Button className="w-full gap-2" onClick={copy}><Copy className="h-4 w-4" /> Copiar código PIX</Button>
            <Button asChild variant="outline" className="w-full gap-2">
              <a href={data.whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={onClose}>
                <MessageCircle className="h-4 w-4" /> Já paguei — enviar pedido e comprovante
              </a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
