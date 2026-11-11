import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { mapOrder } from '@/hooks/useOrders';
import { getStoreFormas, getStoreCondicoes } from '@/lib/dicolorePayments';
import { getStoreRules, releasePaymentRequired } from '@/lib/storeRules';
import { getReleaseIssues } from '@/lib/orderReleaseCheck';
import { mergeEditedCustomer } from '@/lib/orderOwnership';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ReleasePaymentDialog({ order, store, viewer, onClose, onReleased }: { order: any; store: any; viewer: any; onClose: () => void; onReleased: () => void }) {
  const qc = useQueryClient();
  const [forma, setForma] = useState('');
  const [condicao, setCondicao] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setForma(order?.customer?.paymentFormaCodigo || ''); setCondicao(order?.customer?.paymentCondicaoCodigo || ''); }, [order?.id]);
  const formas = getStoreFormas(store?.settings).filter(f => f.ativo);
  const condicoes = getStoreCondicoes(store?.settings).filter(c => c.ativo);
  async function release() {
    if (!order || !forma || !condicao || busy) return;
    // Reserve the window during the click; send the message only after the save succeeds.
    const notify = getStoreRules(store.slug, store.settings).notifyReleaseWhatsapp;
    const win = notify ? window.open('about:blank', '_blank') : null;
    setBusy(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error('Faça login novamente.');
      const { data: row, error: readError } = await supabase.from('orders').select('*').eq('id', order.id).eq('store_id', store.id).single();
      if (readError) throw readError;
      if (!['pendente', 'orcamento'].includes(row.status) || row.xml_downloaded_at) throw new Error('Este pedido não está mais disponível para liberação.');
      const saved = mapOrder(row);
      const customer = mergeEditedCustomer(saved as any, { ...saved.customer,
        paymentFormaCodigo: forma, paymentFormaDescricao: formas.find(f => f.codigo === forma)?.descricao,
        paymentCondicaoCodigo: condicao, paymentCondicaoDescricao: condicoes.find(c => c.codigo === condicao)?.descricao,
      } as any, viewer);
      const issues = getReleaseIssues({ customer, items: saved.items, requirePayment: releasePaymentRequired(store.slug, store.settings) });
      if (issues.length) throw new Error(`Pedido não liberado: ${issues.join('; ')}`);
      const { error } = await supabase.from('orders').update({ customer: customer as any, status: 'liberado_transmissao' }).eq('id', order.id).eq('store_id', store.id).eq('updated_at', row.updated_at).select().single();
      if (error) throw error;
      if (notify) {
        const s = store.settings || {};
        const wa = String(s.erpReleaseWhatsappByTable?.[String(customer.priceTable || '')] || s.erpReleaseWhatsapp || '5547992491139').replace(/\D/g, '');
        const url = `https://wa.me/${wa}?text=${encodeURIComponent(`Olá, o pedido #${saved.orderNumber} do cliente "${customer.name || ''}" pode ser transmitido`)}`;
        if (win) { win.opener = null; win.location.href = url; }
        else window.location.href = url;
      }
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['seller-orders'] });
      toast.success(`Pedido #${saved.orderNumber} salvo e liberado para transmissão`);
      onReleased(); onClose();
    } catch (e: any) { win?.close(); toast.error(e.message || 'Não foi possível liberar o pedido'); }
    finally { setBusy(false); }
  }
  return <Dialog open={!!order} onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="max-w-md">
    <DialogHeader><DialogTitle>Completar pagamento do pedido #{order?.orderNumber}</DialogTitle></DialogHeader>
    <p className="text-sm text-muted-foreground">Falta forma ou condição de pagamento. O pedido permanece pendente até salvar e liberar.</p>
    <div className="space-y-2"><Label>Forma de pagamento</Label><Select value={forma} onValueChange={setForma} disabled={busy}><SelectTrigger aria-label="Forma de pagamento"><SelectValue placeholder="Selecionar forma" /></SelectTrigger><SelectContent>{formas.map(f => <SelectItem key={f.codigo} value={f.codigo}>{f.codigo} — {f.descricao}</SelectItem>)}</SelectContent></Select></div>
    <div className="space-y-2"><Label>Condição de pagamento</Label><Select value={condicao} onValueChange={setCondicao} disabled={busy}><SelectTrigger aria-label="Condição de pagamento"><SelectValue placeholder="Selecionar condição" /></SelectTrigger><SelectContent>{condicoes.map(c => <SelectItem key={c.codigo} value={c.codigo}>{c.codigo} — {c.descricao}</SelectItem>)}</SelectContent></Select></div>
    <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button disabled={busy || !forma || !condicao} onClick={release}>Salvar e liberar para transmissão</Button></div>
  </DialogContent></Dialog>;
}