import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, QrCode, CreditCard, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useStoreBySlug } from '@/hooks/useStores';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PixPaymentDialog, PixDialogData } from '@/components/PixPaymentDialog';

export default function PayOrderPage() {
  const { slug, orderId } = useParams<{ slug: string; orderId: string }>();
  const { data: store } = useStoreBySlug(slug || '');
  const [info, setInfo] = useState<{ orderNumber: number; total: number; paymentStatus: string; storeName: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'pix' | 'card' | null>(null);
  const [pix, setPix] = useState<PixDialogData | null>(null);

  const load = async () => {
    const { data, error } = await supabase.functions.invoke('mercadopago', { body: { action: 'status', orderId } });
    const { data: d } = await supabase.functions.invoke('mercadopago', { body: { action: 'info', orderId } });
    if (error && !d) { setError('Pedido não encontrado'); return; }
    if (d?.error) { setError(d.error); return; }
    setInfo({ ...d, paymentStatus: data?.paymentStatus || d.paymentStatus });
  };
  useEffect(() => { if (orderId) load(); }, [orderId]);

  const gw = (store?.settings as any)?.paymentGateway || {};
  const waUrl = store?.whatsapp ? `https://wa.me/${String(store.whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(`Paguei o pedido #${info?.orderNumber}`)}` : '#';

  const pay = async (method: 'pix' | 'card') => {
    setBusy(method);
    try {
      const { data, error } = await supabase.functions.invoke('mercadopago', { body: { action: 'create', orderId, method } });
      if (error || data?.error) throw new Error(data?.error || 'Não foi possível gerar o pagamento');
      if (method === 'pix') setPix({ payload: data.qrCode, qrImage: data.qrCodeBase64, amount: data.amount, orderNumber: info?.orderNumber, whatsappUrl: waUrl, orderId });
      else window.location.href = data.checkoutUrl;
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-4 p-6 text-center">
          {error ? <p className="text-destructive">{error}</p> : !info ? <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" /> : (
            <>
              <h1 className="text-xl font-bold">{info.storeName}</h1>
              <p>Pedido #{info.orderNumber}</p>
              <p className="text-3xl font-bold">{formatCurrency(info.total)}</p>
              {info.paymentStatus === 'paid' ? (
                <p className="flex items-center justify-center gap-2 font-semibold text-primary"><CheckCircle2 className="h-5 w-5" /> Pagamento confirmado</p>
              ) : (
                <div className="space-y-2">
                  {gw.pixEnabled !== false && <Button className="w-full gap-2" disabled={!!busy} onClick={() => pay('pix')}>{busy === 'pix' ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />} Pagar com PIX</Button>}
                  {gw.cardEnabled && <Button variant="outline" className="w-full gap-2" disabled={!!busy} onClick={() => pay('card')}>{busy === 'card' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Pagar com Cartão</Button>}
                </div>
              )}
              <Button asChild variant="ghost" size="sm"><Link to={`/${slug}`}>Voltar à loja</Link></Button>
            </>
          )}
        </CardContent>
      </Card>
      <PixPaymentDialog data={pix} onClose={() => { setPix(null); load(); }} />
    </div>
  );
}
