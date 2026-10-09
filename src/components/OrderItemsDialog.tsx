import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';

const brl = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function OrderItemsDialog({ order, items }: { order: any; items: any[] }) {
  const [open, setOpen] = useState(false);
  const pieces = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  return (
    <>
      <div className="min-w-[120px] space-y-1">
        <p className="text-xs text-muted-foreground">{items.length} itens · {pieces} peças</p>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setOpen(true)}>
          <Eye className="h-3 w-3" /> Ver Pedido
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pedido #{order.orderNumber} — {order.customer?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div><p className="text-xs text-muted-foreground">Pagamento</p><p className="uppercase">{order.paymentMethod || '-'}</p></div>
            <div><p className="text-xs text-muted-foreground">Itens</p><p>{items.length}</p></div>
            <div><p className="text-xs text-muted-foreground">Peças</p><p>{pieces}</p></div>
            <div><p className="text-xs text-muted-foreground">Total</p><p className="font-semibold">{brl(order.total)}</p></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-2">Código</th><th className="py-2 pr-2">Produto</th>
                  <th className="py-2 pr-2 text-right">Qtd</th><th className="py-2 pr-2 text-right">Unit.</th><th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b align-top">
                    <td className="py-1.5 pr-2 text-xs">{it.code || it.productCode || '-'}</td>
                    <td className="py-1.5 pr-2">
                      {it.name}
                      {it.kitParentName && <span className="ml-1 text-xs text-muted-foreground">(KIT: {it.kitParentName})</span>}
                      {(it.size || it.color) && <span className="ml-1 text-xs text-muted-foreground">— {[it.size, it.color].filter(Boolean).join(' / ')}</span>}
                      {it.observation && <div className="text-xs italic text-muted-foreground">Obs: {it.observation}</div>}
                    </td>
                    <td className="py-1.5 pr-2 text-right">{it.quantity}</td>
                    <td className="py-1.5 pr-2 text-right">{brl(it.price ?? it.unitPrice)}</td>
                    <td className="py-1.5 text-right">{brl((Number(it.price ?? it.unitPrice) || 0) * (Number(it.quantity) || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {order.observation && <p className="text-sm"><span className="text-muted-foreground">Observações:</span> {order.observation}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
