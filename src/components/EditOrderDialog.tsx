import { useState, useMemo, useEffect } from 'react';
import { Plus, Minus, Trash2, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';
import { useUpdateOrder } from '@/hooks/useOrders';
import { computeGroupDiscounts } from '@/lib/groupDiscounts';
import { wouldExceedMaterialApoio, MATERIAL_APOIO_MSG, type MaterialApoioConfig } from '@/lib/materialApoio';
import type { Order, Product, CartItem, DiscountRule, Category, CustomerInfo } from '@/types';
import { getStoreFormas, getStoreCondicoes, isDicoloreFlow } from '@/lib/dicolorePayments';
import { getProductPriceOrNull, normalizePriceTable, type PriceTable } from '@/lib/pricing';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface EditOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  products: Product[];
  discountRules?: DiscountRule[];
  categories?: Category[];
  materialApoio?: MaterialApoioConfig;
  store?: { slug?: string; settings?: any } | null;
  /** Tabela de preço do cliente do pedido (1, 4 ou 9). */
  priceTable?: 1 | 4 | 9;
}

export default function EditOrderDialog({ open, onOpenChange, order, products, discountRules = [], categories = [], materialApoio, store, priceTable }: EditOrderDialogProps) {
  const activeTable: PriceTable = normalizePriceTable(priceTable);
  const updateOrder = useUpdateOrder();
  const [items, setItems] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [formaCodigo, setFormaCodigo] = useState<string>('');
  const [condicaoCodigo, setCondicaoCodigo] = useState<string>('');
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Detect virtual keyboard via VisualViewport (mobile)
  useEffect(() => {
    if (!open) return;
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    if (!vv) return;
    const baseH = window.innerHeight;
    const handler = () => {
      // If viewport shrinks > 150px, assume keyboard is open
      setKeyboardOpen(baseH - vv.height > 150);
    };
    vv.addEventListener('resize', handler);
    handler();
    return () => vv.removeEventListener('resize', handler);
  }, [open]);

  useEffect(() => {
    if (order) {
      setItems(order.items.map(i => ({ ...i })));
      setFormaCodigo(order.customer?.paymentFormaCodigo || '');
      setCondicaoCodigo(order.customer?.paymentCondicaoCodigo || '');
    }
  }, [order]);

  const dicolore = isDicoloreFlow(store?.slug, store?.settings);
  const formas = getStoreFormas(store?.settings).filter(f => f.ativo);
  const condicoes = getStoreCondicoes(store?.settings).filter(c => c.ativo);

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.price * i.quantity, 0), [items]);
  const deliveryFee = order?.deliveryFee || 0;

  // Original coupon discount = total order.discount minus original quantityDiscount.
  // We don't store these separately on the order, so we recompute the original
  // quantityDiscount with current rules to back out the coupon portion.
  const originalCouponDiscount = useMemo(() => {
    if (!order) return 0;
    const { quantityDiscount: origQty } = computeGroupDiscounts(order.items, discountRules, activeTable);
    return Math.max(0, (order.discount || 0) - origQty);
  }, [order, discountRules, activeTable]);

  const { quantityDiscount, itemDiscounts } = useMemo(
    () => computeGroupDiscounts(items, discountRules, activeTable),
    [items, discountRules, activeTable]
  );

  const discount = quantityDiscount + originalCouponDiscount;
  const total = Math.max(0, subtotal + deliveryFee - discount);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = products.filter((p: any) =>
      p.isActive !== false && getProductPriceOrNull(p, activeTable) !== null
    );
    if (!q) return list.slice(0, 30);
    return list.filter((p: any) =>
      p.name?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [products, search, activeTable]);

  const addProduct = (p: any) => {
    const category = categories.find((c: any) => c.id === p.categoryId);
    const resolvedGroupId = p.groupId || category?.name || undefined;
    const unitPrice = getProductPriceOrNull(p, activeTable);
    if (unitPrice === null) {
      toast.error(`Produto sem preço na tabela ${activeTable} do cliente. Não é possível vender por outra tabela.`);
      return;
    }
    const check = wouldExceedMaterialApoio(items, p.id, unitPrice, products, materialApoio);
    if (check.exceeds) { toast.error(MATERIAL_APOIO_MSG); return; }
    setItems(prev => {
      const existing = prev.find(i => i.productId === p.id);
      if (existing) {
        return prev.map(i => i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        productId: p.id,
        name: p.name,
        code: p.code || '',
        price: unitPrice,
        quantity: 1,
        image: p.image,
        groupId: resolvedGroupId,
      }];
    });
  };

  const updateQty = (idx: number, delta: number) => {
    if (delta > 0) {
      const it = items[idx];
      if (it) {
        const check = wouldExceedMaterialApoio(items, it.productId, it.price * delta, products, materialApoio);
        if (check.exceeds) { toast.error(MATERIAL_APOIO_MSG); return; }
      }
    }
    setItems(prev => prev.map((i, k) => {
      if (k !== idx) return i;
      const q = i.quantity + delta;
      return q <= 0 ? i : { ...i, quantity: q };
    }));
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, k) => k !== idx));

  const handleSave = async () => {
    if (!order) return;
    if (items.length === 0) { toast.error('O pedido precisa ter pelo menos um item'); return; }
    setSaving(true);
    try {
      const stampedItems = items.map(it => {
        const key = `${it.productId}-${it.variantId || ''}`;
        const pct = itemDiscounts[key];
        return pct ? { ...it, discountPercent: pct } : { ...it, discountPercent: undefined };
      });
      const updates: any = { id: order.id, items: stampedItems, subtotal, total, discount };
      if (dicolore) {
        const f = formas.find(x => x.codigo === formaCodigo);
        const c = condicoes.find(x => x.codigo === condicaoCodigo);
        const newCustomer: CustomerInfo = {
          ...order.customer,
          paymentFormaCodigo: formaCodigo || undefined,
          paymentFormaDescricao: f?.descricao,
          paymentCondicaoCodigo: condicaoCodigo || undefined,
          paymentCondicaoDescricao: c?.descricao,
        };
        updates.customer = newCustomer;
      }
      await updateOrder.mutateAsync(updates);
      toast.success('Pedido atualizado!');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar pedido');
    } finally {
      setSaving(false);
    }
  };

  if (!order) return null;

  // Pedidos já transmitidos (qualquer status != 'pendente') só permitem
  // EXCLUIR itens — não dá pra aumentar quantidade nem adicionar novos.
  const removeOnly = order.status !== 'pendente';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[100vw] sm:w-auto h-[100dvh] sm:h-auto sm:max-h-[90vh] p-4 sm:p-6 flex flex-col rounded-none sm:rounded-lg">
        <DialogHeader>
          <DialogTitle>Editar Pedido #{order.orderNumber}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pb-32 sm:pb-0">
          {removeOnly && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
              Este pedido já foi transmitido. Você só pode <strong>excluir itens</strong> que o cliente desistiu — não é possível adicionar produtos ou aumentar quantidades.
            </div>
          )}
          {/* Current items */}
          <div className="border rounded-md">
            <div className="px-3 py-2 border-b bg-muted/30 text-sm font-semibold">
              Itens do pedido ({items.length})
            </div>
            {items.length === 0 ? (
              <p className="p-4 text-sm text-center text-muted-foreground">Nenhum item</p>
            ) : (
              <div className="divide-y max-h-[280px] overflow-y-auto">
                {items.map((item, idx) => {
                  const dKey = `${item.productId}-${item.variantId || ''}`;
                  const pct = itemDiscounts[dKey] || 0;
                  return (
                  <div key={`${item.productId}-${idx}`} className="flex items-center justify-between p-3 gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(item.price)} {item.code ? `• ${item.code}` : ''}
                        {pct > 0 && <span className="ml-1 text-green-700 font-semibold">• -{pct}%</span>}
                      </p>
                      {item.ingredients?.length ? (
                        <p className="text-xs text-muted-foreground">+ {item.ingredients.map((x: any) => x.name).join(', ')}</p>
                      ) : null}
                      {item.removedIngredients?.length ? (
                        <p className="text-xs text-muted-foreground">− {item.removedIngredients.map((x: any) => x.name).join(', ')}</p>
                      ) : null}
                      {item.border ? (
                        <p className="text-xs text-muted-foreground">Borda: {item.border.name}</p>
                      ) : null}
                      {item.observation ? (
                        <p className="text-xs italic text-muted-foreground">Obs: {item.observation}</p>
                      ) : null}
                    </div>
                    {removeOnly ? (
                      <span className="w-12 text-center text-sm font-medium">{item.quantity}x</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(idx, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(idx, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <span className="text-sm font-medium w-24 text-right">{formatCurrency(item.price * item.quantity)}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(idx)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add product — só para pedidos pendentes */}
          {!removeOnly && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto para adicionar..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="border rounded-md max-h-[220px] overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="p-4 text-sm text-center text-muted-foreground">Nenhum produto encontrado</p>
              ) : (
                <div className="divide-y">
                  {filtered.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-2 hover:bg-muted/40">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(getProductPriceOrNull(p, activeTable) ?? 0)} {p.code ? `• ${p.code}` : ''}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => addProduct(p)}>
                        <Plus className="h-3 w-3 mr-1" /> Adicionar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}

          {/* Dicolore — Forma e Condição de Pagamento (ERP) */}
          {dicolore && (formas.length > 0 || condicoes.length > 0) && (
            <div className="border rounded-md p-3 space-y-3">
              <p className="text-sm font-semibold">Pagamento (ERP)</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-xs">Forma de Pagamento</Label>
                  <Select value={formaCodigo} onValueChange={setFormaCodigo}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent className="max-h-[40vh]">
                      {formas.map(f => (
                        <SelectItem key={f.codigo} value={f.codigo}>{f.codigo} - {f.descricao}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Condição de Pagamento</Label>
                  <Select value={condicaoCodigo} onValueChange={setCondicaoCodigo}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent className="max-h-[40vh]">
                      {condicoes.map(c => (
                        <SelectItem key={c.codigo} value={c.codigo}>{c.codigo} - {c.descricao}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="border rounded-md p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            {quantityDiscount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Desconto por quantidade</span><span className="text-green-700">-{formatCurrency(quantityDiscount)}</span></div>}
            {originalCouponDiscount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Cupom</span><span>-{formatCurrency(originalCouponDiscount)}</span></div>}
            {deliveryFee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Entrega</span><span>{formatCurrency(deliveryFee)}</span></div>}
            <div className="flex justify-between font-bold text-base border-t pt-1"><span>Total</span><span>{formatCurrency(total)}</span></div>
          </div>

          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Badge variant="outline" className="text-[10px]">Dica</Badge>
            {removeOnly
              ? <>Pedido transmitido: somente exclusão de itens é permitida.</>
              : <>Pedidos <strong>Pendentes</strong> permitem edição completa (adicionar, remover e alterar quantidades).</>}
          </p>
        </div>

        <DialogFooter
          className={`flex-col sm:flex-row gap-2 pt-3 border-t mt-2 bg-background sm:static sm:!flex fixed bottom-0 left-0 right-0 px-4 pb-[env(safe-area-inset-bottom)] z-10 ${keyboardOpen ? 'hidden sm:flex' : 'flex'}`}
        >
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button className="w-full sm:w-auto" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar alterações'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
