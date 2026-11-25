import { useSyncExternalStore } from 'react';
import { closeOrderPriceIssues, getOrderPriceIssues, subscribeOrderPriceIssues } from '@/lib/orderPriceIssues';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function OrderPriceIssuesDialog() {
  const issue = useSyncExternalStore(subscribeOrderPriceIssues, getOrderPriceIssues, () => null);
  return (
    <Dialog open={issue !== null} onOpenChange={open => { if (!open) closeOrderPriceIssues(); }}>
      <DialogContent className="flex max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl flex-col rounded-lg">
        <DialogHeader className="pr-6 text-left">
          <DialogTitle className="leading-snug tracking-normal">
            {issue?.title || 'Produtos sem preço'}{issue?.orderNumber ? ` — Pedido #${issue.orderNumber}` : ''}
          </DialogTitle>
          <DialogDescription>
            {issue?.items.length} {issue?.items.length === 1 ? 'item' : 'itens'} · Tabela {issue?.table}.
            {' '}{issue?.description}
          </DialogDescription>
        </DialogHeader>
        <ul aria-label="Produtos com pendências" className="min-h-0 overflow-y-auto divide-y divide-border rounded-md border border-border">
          {issue?.items.map((item, index) => (
            <li key={`${item.productId}-${item.variantId || ''}-${index}`} className="space-y-1 p-3">
              <p className="break-words text-sm font-medium">{item.name}</p>
              <p className="break-all text-xs text-muted-foreground">Código: {item.code || 'Não informado'}</p>
              {(item.color || item.size) && <p className="break-words text-xs text-muted-foreground">{[item.color, item.size].filter(Boolean).join(' / ')}</p>}
            </li>
          ))}
        </ul>
        <DialogFooter><Button variant="outline" onClick={closeOrderPriceIssues}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}