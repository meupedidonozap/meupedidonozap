import { useState, useMemo } from 'react';
import type { ServiceOrder, ServiceOrderExtraItem, ServiceOrderStatus, Product, CartItem } from '@/types';
import { useUpdateServiceOrder } from '@/hooks/useServiceOrders';
import { useProducts } from '@/hooks/useProducts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';
import { Plus, Trash2, Send, Search, Package } from 'lucide-react';

const statusLabels: Record<ServiceOrderStatus, string> = {
  aberta: 'Aberta',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

const statusColors: Record<ServiceOrderStatus, string> = {
  aberta: 'bg-yellow-100 text-yellow-700',
  em_andamento: 'bg-blue-100 text-blue-700',
  concluida: 'bg-green-100 text-green-700',
  cancelada: 'bg-red-100 text-red-700',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceOrder: ServiceOrder | null;
  storeName: string;
  storeWhatsapp: string;
  onOrderUpdate?: (params: { orderId: string; status: string; total: number }) => Promise<void>;
}

export default function ServiceOrderDialog({ open, onOpenChange, serviceOrder, storeName, storeWhatsapp, onOrderUpdate }: Props) {
  const updateSO = useUpdateServiceOrder();
  const { data: products = [] } = useProducts(serviceOrder?.storeId);

  const [extraItems, setExtraItems] = useState<ServiceOrderExtraItem[]>([]);
  const [status, setStatus] = useState<ServiceOrderStatus>('aberta');
  const [observations, setObservations] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Manual item form
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualQty, setManualQty] = useState('1');

  // Product search
  const [productSearch, setProductSearch] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);

  // Initialize from serviceOrder
  if (serviceOrder && !initialized) {
    setExtraItems(serviceOrder.extraItems || []);
    setStatus(serviceOrder.status);
    setObservations(serviceOrder.observations || '');
    setInitialized(true);
  }

  // Reset on close
  const handleOpenChange = (v: boolean) => {
    if (!v) setInitialized(false);
    onOpenChange(v);
  };

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 10);
    const q = productSearch.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q)).slice(0, 10);
  }, [products, productSearch]);

  const itemsTotal = useMemo(() => {
    if (!serviceOrder) return 0;
    return serviceOrder.items.reduce((s, i) => s + i.price * i.quantity, 0);
  }, [serviceOrder]);

  const extrasTotal = useMemo(() => {
    return extraItems.reduce((s, i) => s + i.price * i.quantity, 0);
  }, [extraItems]);

  const grandTotal = itemsTotal + extrasTotal - (serviceOrder?.discount || 0);

  const handleAddManualItem = () => {
    if (!manualName.trim() || !manualPrice) return;
    const newItem: ServiceOrderExtraItem = {
      id: crypto.randomUUID(),
      name: manualName.trim(),
      price: parseFloat(manualPrice),
      quantity: parseInt(manualQty) || 1,
    };
    setExtraItems(prev => [...prev, newItem]);
    setManualName('');
    setManualPrice('');
    setManualQty('1');
  };

  const handleAddProductItem = (product: Product) => {
    const newItem: ServiceOrderExtraItem = {
      id: crypto.randomUUID(),
      name: product.name,
      description: product.code,
      price: product.basePrice,
      quantity: 1,
    };
    setExtraItems(prev => [...prev, newItem]);
    setShowProductSearch(false);
    setProductSearch('');
  };

  const handleRemoveExtra = (id: string) => {
    setExtraItems(prev => prev.filter(i => i.id !== id));
  };

  const handleSave = async () => {
    if (!serviceOrder) return;
    try {
      // Merge extras into items as CartItem
      const extrasAsCartItems: CartItem[] = extraItems.map(item => ({
        productId: item.id,
        name: item.name,
        code: item.description || '',
        price: item.price,
        quantity: item.quantity,
      }));
      const mergedItems = [...serviceOrder.items, ...extrasAsCartItems];

      await updateSO.mutateAsync({
        id: serviceOrder.id,
        storeId: serviceOrder.storeId,
        items: mergedItems,
        extraItems,
        subtotal: itemsTotal + extrasTotal,
        total: grandTotal,
        status,
        observations,
      });

      // Sync order status and total based on OS status
      if (onOrderUpdate && serviceOrder.orderId) {
        if (status === 'concluida') {
          await onOrderUpdate({ orderId: serviceOrder.orderId, status: 'enviado', total: grandTotal });
        } else if (status === 'cancelada') {
          await onOrderUpdate({ orderId: serviceOrder.orderId, status: 'cancelado', total: grandTotal });
        }
      }

      toast.success('OS atualizada!');
      handleOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar OS');
    }
  };

  const handleSendWhatsApp = () => {
    if (!serviceOrder) return;
    const customer = serviceOrder.customer;
    let msg = `*ORDEM DE SERVIÇO #${serviceOrder.osNumber}*\n`;
    msg += `Loja: ${storeName}\n`;
    msg += `Cliente: ${customer.name}\n`;
    msg += `WhatsApp: ${customer.whatsapp}\n\n`;

    msg += `*SERVIÇOS:*\n`;
    serviceOrder.items.forEach(item => {
      msg += `${item.quantity}x ${item.name} - ${formatCurrency(item.price * item.quantity)}\n`;
    });

    if (extraItems.length > 0) {
      msg += `\n*MATERIAIS ADICIONAIS:*\n`;
      extraItems.forEach(item => {
        msg += `${item.quantity}x ${item.name} - ${formatCurrency(item.price * item.quantity)}\n`;
      });
    }

    msg += `\nSubtotal: ${formatCurrency(itemsTotal + extrasTotal)}`;
    if (serviceOrder.discount > 0) msg += `\nDesconto: -${formatCurrency(serviceOrder.discount)}`;
    msg += `\n*Total: ${formatCurrency(grandTotal)}*`;
    msg += `\n\nStatus: ${statusLabels[status]}`;

    const target = customer.whatsapp || storeWhatsapp;
    const phone = target.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (!serviceOrder) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            OS #{serviceOrder.osNumber}
            <Badge className={statusColors[status]}>{statusLabels[status]}</Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Customer info */}
        <div className="rounded-lg border p-3 text-sm">
          <p className="font-medium">{serviceOrder.customer.name}</p>
          <p className="text-muted-foreground">{serviceOrder.customer.whatsapp}</p>
          {serviceOrder.customer.address && (
            <p className="text-muted-foreground">{serviceOrder.customer.address}, {serviceOrder.customer.number} - {serviceOrder.customer.city}/{serviceOrder.customer.uf}</p>
          )}
        </div>

        {/* Original items */}
        <div>
          <h4 className="mb-2 font-semibold text-sm">Serviços do Pedido</h4>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Item</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Valor</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {serviceOrder.items.map((item, i) => (
                <TableRow key={i}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.price * item.quantity)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Extra items */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="font-semibold text-sm">Materiais Adicionais</h4>
            <Button variant="outline" size="sm" onClick={() => setShowProductSearch(!showProductSearch)} className="gap-1">
              <Package className="h-3 w-3" /> Do Catálogo
            </Button>
          </div>

          {showProductSearch && (
            <div className="mb-3 rounded-lg border p-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar produto..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="pl-8" />
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {filteredProducts.map(p => (
                  <button key={p.id} onClick={() => handleAddProductItem(p)} className="flex w-full items-center justify-between rounded p-2 text-sm hover:bg-muted">
                    <span>{p.name}</span>
                    <span className="text-muted-foreground">{formatCurrency(p.basePrice)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {extraItems.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Item</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Valor</TableHead><TableHead></TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {extraItems.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.price * item.quantity)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemoveExtra(item.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Add manual item */}
          <div className="mt-2 flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs">Nome</Label>
              <Input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Item avulso" className="h-8 text-sm" />
            </div>
            <div className="w-20">
              <Label className="text-xs">Valor</Label>
              <Input type="number" step="0.01" value={manualPrice} onChange={e => setManualPrice(e.target.value)} placeholder="0,00" className="h-8 text-sm" />
            </div>
            <div className="w-14">
              <Label className="text-xs">Qtd</Label>
              <Input type="number" min="1" value={manualQty} onChange={e => setManualQty(e.target.value)} className="h-8 text-sm" />
            </div>
            <Button size="sm" variant="outline" className="h-8" onClick={handleAddManualItem}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Totals */}
        <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
          <div className="flex justify-between"><span>Serviços:</span><span>{formatCurrency(itemsTotal)}</span></div>
          <div className="flex justify-between"><span>Materiais:</span><span>{formatCurrency(extrasTotal)}</span></div>
          {serviceOrder.discount > 0 && <div className="flex justify-between text-destructive"><span>Desconto:</span><span>-{formatCurrency(serviceOrder.discount)}</span></div>}
          <div className="flex justify-between font-bold text-base border-t pt-1"><span>Total:</span><span>{formatCurrency(grandTotal)}</span></div>
        </div>

        {/* Status + observations */}
        <div className="grid gap-3">
          <div>
            <Label className="text-sm">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ServiceOrderStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm">Observações</Label>
            <Textarea value={observations} onChange={e => setObservations(e.target.value)} rows={2} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={handleSendWhatsApp} className="gap-2">
            <Send className="h-4 w-4" /> Enviar WhatsApp
          </Button>
          <Button onClick={handleSave} disabled={updateSO.isPending}>
            Salvar OS
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
