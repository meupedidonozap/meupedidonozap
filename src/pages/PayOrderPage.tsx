import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Loader2, QrCode, CreditCard, CheckCircle2, XCircle, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useStoreBySlug } from '@/hooks/useStores';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PixPaymentDialog, PixDialogData } from '@/components/PixPaymentDialog';

const FAILED = ['rejected', 'cancelled', 'refunded', 'charged_back'];

export default function PayOrderPage() {
  const { slug, orderId } = useParams<{ slug: string; orderId: string }>();
  const [sp] = useSearchParams();
  const isReturn = sp.get('retorno') === '1';
  const { data: store } = useStoreBySlug(slug || '');
  const [info, setInfo] = useState<{ orderNumber: number; total: number; paymentStatus: string; storeName: string; lastStatus?: string | null } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'pix' | 'card' | null>(null);
  const [pix, setPix] = useState<PixDialogData | null>(null);
  const [checking, setChecking] = useState(isReturn);
  const tries = useRef(0);

  const load = async () => {
    const { data: d } = await supabase.functions.invoke('mercadopago', { body: { action: 'info', orderId } });
    if (!d || d.error) { setError(d?.error || 'Pedido não encontrado'); return null; }
    const { data } = await supabase.functions.invoke('mercadopago', { body: { action: 'status', orderId } });
    const next = { ...d, paymentStatus: data?.paymentStatus || d.paymentStatus, lastStatus: data?.lastStatus };
    setInfo(next);
    return next;
  };

  useEffect(() => {
    if (!orderId) return;
    let stop = false;
    const run = async () => {
      const r = await load();
      if (!isReturn || stop || !r) { setChecking(false); return; }
      if (r.paymentStatus === 'paid' || FAILED.includes(r.lastStatus || '') || ++tries.current >= 30) { setChecking(false); return; }
      setTimeout(run, 4000);
    };
    run();
    return () => { stop = true; };
  }, [orderId]);

  const gw = (store?.settings as any)?.paymentGateway || {};
  const wa = String(store?.whatsapp || '').replace(/\D/g, '');
  const waPaid = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(`✅ Pagamento confirmado do pedido #${info?.orderNumber} (${info ? formatCurrency(info.total) : ''})`)}` : '';

  const pay = async (method: 'pix' | 'card') => {
    setBusy(method);
    try {
      const { data, error } = await supabase.functions.invoke('mercadopago', { body: { action: 'create', orderId, method } });
      if (error || data?.error) throw new Error(data?.error || 'Não foi possível gerar o pagamento');
      if (method === 'pix') setPix({ payload: data.qrCode, qrImage: data.qrCodeBase64, amount: data.amount, orderNumber: info?.orderNumber, whatsappUrl: waPaid || '#', orderId });
      else window.location.href = data.checkoutUrl;
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };

  const paid = info?.paymentStatus === 'paid';
  const failed = !paid && FAILED.includes(info?.lastStatus || '');

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-4 p-6 text-center">
          {error ? <p className="text-destructive">{error}</p> : !info ? <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" /> : (
            <>
              <h1 className="text-xl font-bold">{info.storeName}</h1>
              <p>Pedido #{info.orderNumber}</p>
              <p className="text-3xl font-bold">{formatCurrency(info.total)}</p>
              {paid ? (
                <div className="space-y-3">
                  <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
                  <p className="font-semibold text-primary">Pagamento confirmado — Pedido PAGO</p>
                  {waPaid && <Button asChild className="w-full gap-2"><a href={waPaid} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" /> Enviar pedido no WhatsApp</a></Button>}
                </div>
              ) : checking ? (
                <p className="flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Aguardando confirmação do Mercado Pago...</p>
              ) : (
                <div className="space-y-2">
                  {failed && <p className="flex items-center justify-center gap-2 font-semibold text-destructive"><XCircle className="h-5 w-5" /> Pagamento não aprovado</p>}
                  {gw.cardEnabled && <Button className="w-full gap-2" disabled={!!busy} onClick={() => pay('card')}>{busy === 'card' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} {failed ? 'Tentar de novo (Cartão)' : 'Pagar com Cartão'}</Button>}
                  {gw.pixEnabled !== false && <Button variant={gw.cardEnabled ? 'outline' : 'default'} className="w-full gap-2" disabled={!!busy} onClick={() => pay('pix')}>{busy === 'pix' ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />} Pagar com PIX</Button>}
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
