import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Send, Lock, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { mapOrder } from '@/hooks/useOrders';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useSellerMode } from '@/hooks/useSellerMode';
import { canEditOrder } from '@/lib/orderOwnership';
import { resolveStorePriceTable } from '@/lib/pricing';
import { formatCurrency } from '@/lib/formatters';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import EditOrderDialog from '@/components/EditOrderDialog';
import type { Order } from '@/types';

type Props = { orderId: string | null; store: any; onClose: () => void };

export default function SellerPendingOrderDialog({ orderId, store, onClose }: Props) {
  const qc = useQueryClient();
  const seller = useSellerMode(store?.id);
  const { data: products = [] } = useProducts(orderId ? store?.id : undefined);
  const { data: categories = [] } = useCategories(orderId ? store?.id : undefined);
  const [editing, setEditing] = useState(false);
  const [obs, setObs] = useState('');
  const [busy, setBusy] = useState(false);

  const { data: order, isLoading, refetch } = useQuery({
    queryKey: ['seller-order-detail', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase.from('orders').select('*').eq('id', orderId!).single();
      if (error) throw error;
      return mapOrder(data);
    },
  });
  useEffect(() => { setObs(order?.observations || ''); }, [order?.id, order?.observations]);

  const viewer = { isAdmin: seller.isAdmin, isTelevendas: seller.isTelevendas, name: seller.sellerName, erpCode: seller.erpCode };
  const editable = !!order && order.status === 'pendente' && !order.xmlDownloadedAt && canEditOrder(order as any, viewer);

  const refresh = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ['seller-orders'] });
    qc.invalidateQueries({ queryKey: ['orders'] });
  };

  const saveObs = async () => {
    if (!order) return;
    setBusy(true);
    const { error } = await supabase.from('orders').update({ observations: obs.trim() || null }).eq('id', order.id).select().single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Observação salva');
    refresh();
  };

  const release = async () => {
    if (!order) return;
    const code = String((order.customer as any)?.customerCode || '').trim();
    if (!code) { toast.error('Cliente sem cadastro no ERP. Cadastre no ERP e sincronize antes de transmitir.'); return; }
    if (!confirm(`Liberar o pedido #${order.orderNumber} para transmissão ao ERP?`)) return;
    // Abre o WhatsApp antes de qualquer await (iOS bloqueia depois).
    const s = store?.settings || {};
    const pt = (order.customer as any)?.priceTable ? String((order.customer as any).priceTable) : '';
    const wa = String((pt && s.erpReleaseWhatsappByTable?.[pt]) || s.erpReleaseWhatsapp || '5547992491139').replace(/\D/g, '');
    if (wa) window.open(`https://wa.me/${wa}?text=${encodeURIComponent(`Olá, o pedido "#${order.orderNumber}" pode ser transmitido`)}`, '_blank');
    setBusy(true);
    const { error } = await supabase.from('orders').update({ status: 'liberado_transmissao', observations: obs.trim() || null }).eq('id', order.id).select().single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Pedido liberado para transmissão');
    refresh();
    onClose();
  };

  const priceTable = order
    ? resolveStorePriceTable(store?.slug, (order.customer as any)?.priceTable)
    : undefined;

  return (
    <>
      <Dialog open={!!orderId && !editing} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {isLoading || !order ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
            <>
              <DialogHeader><DialogTitle>Pedido #{order.orderNumber} — {order.customer?.name}</DialogTitle></DialogHeader>
              <div className="grid gap-1 text-sm sm:grid-cols-2">
                <p><b>Cliente:</b> {(order.customer as any)?.customerCode || 'sem código ERP'}</p>
                <p><b>Data:</b> {new Date(order.createdAt).toLocaleDateString('pt-BR')}</p>
                <p><b>Status:</b> {order.status === 'pendente' ? 'Pendente' : order.status === 'liberado_transmissao' ? 'Liberado p/ Transmissão' : order.status}</p>
                <p><b>Total:</b> {formatCurrency(order.total)}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b text-left text-muted-foreground">
                    <th className="p-1">Código</th><th className="p-1">Produto</th><th className="p-1 text-right">Qtd</th><th className="p-1 text-right">Unit.</th><th className="p-1 text-right">Total</th>
                  </tr></thead>
                  <tbody>{order.items.map((it: any, i: number) => (
                    <tr key={i} className="border-b">
                      <td className="p-1">{it.code}</td><td className="p-1">{it.name}</td>
                      <td className="p-1 text-right">{it.quantity}</td>
                      <td className="p-1 text-right">{formatCurrency(Number(it.price))}</td>
                      <td className="p-1 text-right">{formatCurrency(Number(it.price) * Number(it.quantity))}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold">Observação</p>
                <Textarea value={obs} onChange={(e) => setObs(e.target.value)} disabled={!editable || busy} rows={3} placeholder="Observação do pedido" />
              </div>
              {editable ? (
                <div className="grid gap-2 sm:flex sm:justify-end">
                  <Button variant="outline" disabled={busy} onClick={saveObs}><Save className="mr-1 h-4 w-4" /> Salvar observação</Button>
                  <Button variant="secondary" disabled={busy} onClick={() => setEditing(true)}><Pencil className="mr-1 h-4 w-4" /> Editar itens</Button>
                  <Button disabled={busy} onClick={release}><Send className="mr-1 h-4 w-4" /> Liberar p/ transmissão</Button>
                </div>
              ) : (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  {order.status !== 'pendente' ? 'Pedido já liberado — somente visualização' : 'Pedido de outro responsável — somente visualização'}
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      <EditOrderDialog
        open={editing}
        onOpenChange={(v) => { if (!v) { setEditing(false); refresh(); } }}
        order={(order as Order) || null}
        products={products as any}
        discountRules={store?.settings?.discountRules || []}
        categories={categories as any}
        materialApoio={store?.settings?.materialApoio}
        store={store}
        priceTable={priceTable as any}
      />
    </>
  );
}
