import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Printer, X, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import {
  useTabs, useAddTab, useTabItems, useAddTabItem, useUpdateTabItem,
  useDeleteTabItem, useCloseSession,
} from '@/hooks/useTables';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useIngredients } from '@/hooks/useIngredients';
import { usePizzaBorders } from '@/hooks/usePizzaBorders';
import { useProductAssemblies } from '@/hooks/useProductAssembly';
import { useCreateOrder, useOrders, useUpdateOrderStatus, useUpdateOrder } from '@/hooks/useOrders';
import AssemblyDialog from './AssemblyDialog';
import type { Product, TabItem, CartItem, OrderStatus } from '@/types';
import { Select as StatusSelect, SelectContent as StatusSelectContent, SelectItem as StatusSelectItem, SelectTrigger as StatusSelectTrigger, SelectValue as StatusSelectValue } from '@/components/ui/select';

interface Props {
  sessionId: string;
  storeId: string;
  tableNumber?: number;
  onClose: () => void;
}

export default function TableSessionDialog({ sessionId, storeId, tableNumber, onClose }: Props) {
  const { data: tabs = [] } = useTabs(sessionId);
  const { data: items = [] } = useTabItems(sessionId);
  const { data: categories = [] } = useCategories(storeId);
  const { data: products = [] } = useProducts(storeId);
  const { data: ingredients = [] } = useIngredients(storeId);
  const { data: borders = [] } = usePizzaBorders(storeId);
  const { data: assemblies = [] } = useProductAssemblies(storeId);
  const { data: storeOrders = [] } = useOrders(storeId);
  const addTab = useAddTab();
  const addItem = useAddTabItem();
  const updateItem = useUpdateTabItem();
  const deleteItem = useDeleteTabItem();
  const closeSession = useCloseSession();
  const createOrder = useCreateOrder();
  const updateOrderStatus = useUpdateOrderStatus();
  const updateOrder = useUpdateOrder();

  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [assemblyProd, setAssemblyProd] = useState<Product | null>(null);
  const [showPayment, setShowPayment] = useState(false);

  const currentTabId = activeTabId || tabs[0]?.id;

  // Find linked order for a tab item (paidOrderId is reused as "linked order id")
  const orderById = useMemo(() => {
    const m: Record<string, any> = {};
    storeOrders.forEach(o => { m[o.id] = o; });
    return m;
  }, [storeOrders]);

  const itemsByTab = useMemo(() => {
    const m: Record<string, TabItem[]> = {};
    items.filter(i => i.status !== 'pago' && i.status !== 'cancelado').forEach(i => {
      (m[i.tabId] = m[i.tabId] || []).push(i);
    });
    return m;
  }, [items]);

  const sessionTotal = useMemo(() =>
    items.filter(i => i.status !== 'pago' && i.status !== 'cancelado')
      .reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  , [items]);

  const handleAddTab = async () => {
    const next = (tabs.length ? Math.max(...tabs.map(t => t.number)) : 0) + 1;
    if (next > 6) { toast.error('Máx. 6 comandas por mesa'); return; }
    const label = prompt(`Etiqueta da comanda ${next} (opcional):`) || '';
    await addTab.mutateAsync({ sessionId, number: next, label });
    toast.success('Comanda adicionada');
  };

  const getAssembly = (productId: string) =>
    assemblies.find(a => a.productId === productId);

  const needsAssembly = (p: Product) => {
    const a = getAssembly(p.id);
    if (a && (a.mode !== 'fixed' || a.allowBorder || a.allowObservation)) return true;
    if (p.hasVariants && (p.variants?.length || 0) > 1) return true;
    return false;
  };

  const buildCustomerForTab = (tabNumber: number, tabLabel?: string) => ({
    name: `MESA ${tableNumber ?? ''} · C${tabNumber}${tabLabel ? ` ${tabLabel}` : ''}`.trim(),
    cpfCnpj: '', whatsapp: '', cep: '', uf: '', city: '', neighborhood: '', address: '', number: '',
  });

  const buildObservationsForTab = (tabNumber: number, tabLabel?: string, extra?: string) =>
    `Mesa ${tableNumber ?? ''} - Comanda ${tabNumber}${tabLabel ? ` (${tabLabel})` : ''}${extra ? ` | ${extra}` : ''}`.trim();

  const createLinkedOrder = async (tabId: string, cartItem: CartItem) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return null;
    const subtotal = cartItem.price * cartItem.quantity;
    const order = await createOrder.mutateAsync({
      storeId,
      customer: buildCustomerForTab(tab.number, tab.label),
      items: [cartItem],
      subtotal,
      discount: 0,
      deliveryFee: 0,
      total: subtotal,
      paymentMethod: '' as any,
      deliveryShift: 'tarde' as any,
      observations: buildObservationsForTab(tab.number, tab.label, cartItem.observation),
      status: 'pendente' as any,
      origem: 'mesa',
    } as any);
    return order;
  };

  const launchSimple = async (p: Product) => {
    if (!currentTabId) { toast.error('Crie uma comanda primeiro'); return; }
    const cartItem: CartItem = {
      productId: p.id, name: p.name, code: p.code || '',
      price: p.basePrice, quantity: 1, image: p.image,
      ingredients: [], removedIngredients: [],
    } as any;
    const order = await createLinkedOrder(currentTabId, cartItem);
    const item = await addItem.mutateAsync({
      tabId: currentTabId,
      productId: p.id,
      name: p.name,
      code: p.code || '',
      unitPrice: p.basePrice,
      quantity: 1,
      ingredients: [],
      removedIngredients: [],
      image: p.image,
    } as any);
    if (order && item) {
      await updateItem.mutateAsync({ id: item.id, paidOrderId: order.id });
    }
    toast.success(`${p.name} lançado`);
  };

  const launchAssembled = async (item: CartItem) => {
    if (!currentTabId) return;
    const order = await createLinkedOrder(currentTabId, item);
    const created = await addItem.mutateAsync({
      tabId: currentTabId,
      productId: item.productId,
      variantId: item.variantId,
      name: item.name + (item.size ? ` ${item.size}` : ''),
      code: item.code || '',
      unitPrice: item.price,
      quantity: item.quantity,
      ingredients: item.ingredients || [],
      removedIngredients: item.removedIngredients || [],
      border: item.border,
      observation: item.observation,
      image: item.image,
    } as any);
    if (order && created) {
      await updateItem.mutateAsync({ id: created.id, paidOrderId: order.id });
    }
    toast.success('Item lançado');
  };

  const handleProductClick = (p: Product) => {
    if (needsAssembly(p)) setAssemblyProd(p);
    else launchSimple(p);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mesa {tableNumber ?? '-'} — Comandas</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2">
          <div className="text-sm">
            Total da mesa: <strong className="text-lg">{formatCurrency(sessionTotal)}</strong>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleAddTab}><Plus className="mr-1 h-4 w-4" /> Comanda</Button>
            <Button size="sm" variant="default" onClick={() => setCatalogOpen(true)}>
              <ShoppingCart className="mr-1 h-4 w-4" /> Lançar item
            </Button>
            <Button size="sm" variant="secondary" onClick={() => window.print()}>
              <Printer className="mr-1 h-4 w-4" /> Conferência
            </Button>
            <Button size="sm" onClick={() => setShowPayment(true)} disabled={sessionTotal === 0}>Pagar</Button>
          </div>
        </div>

        {tabs.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">Nenhuma comanda. Adicione uma para começar.</p>
        ) : (
          <Tabs value={currentTabId || ''} onValueChange={setActiveTabId}>
            <TabsList className="flex-wrap">
              {tabs.map(t => (
                <TabsTrigger key={t.id} value={t.id}>
                  C{t.number}{t.label ? ` · ${t.label}` : ''} ({(itemsByTab[t.id] || []).length})
                </TabsTrigger>
              ))}
            </TabsList>
            {tabs.map(t => {
              const tabItems = itemsByTab[t.id] || [];
              const tabTotal = tabItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
              return (
                <TabsContent key={t.id} value={t.id}>
                  {tabItems.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">Sem itens.</p>
                  ) : (
                    <div className="space-y-2">
                      {tabItems.map(i => (
                        <Card key={i.id}>
                          <CardContent className="flex items-center justify-between p-2">
                            <div className="flex-1">
                              <div className="font-medium">{i.quantity}x {i.name}</div>
                              {i.ingredients.length > 0 && (
                                <div className="text-xs text-muted-foreground">+ {i.ingredients.map(x => x.name).join(', ')}</div>
                              )}
                              {i.removedIngredients.length > 0 && (
                                <div className="text-xs text-muted-foreground">SEM {i.removedIngredients.map(x => x.name).join(', ')}</div>
                              )}
                              {i.border && <div className="text-xs">Borda: {i.border.name}</div>}
                              {i.observation && <div className="text-xs italic">Obs: {i.observation}</div>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{formatCurrency(i.unitPrice * i.quantity)}</span>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                                onClick={async () => { if (confirm('Remover item?')) { await deleteItem.mutateAsync(i.id); }}}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      <div className="text-right text-sm">Subtotal C{t.number}: <strong>{formatCurrency(tabTotal)}</strong></div>
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>

      {/* Catalog mini-dialog */}
      {catalogOpen && (
        <Dialog open onOpenChange={setCatalogOpen}>
          <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
            <DialogHeader><DialogTitle>Lançar item — escolha produto</DialogTitle></DialogHeader>
            {!currentTabId && <p className="text-sm text-destructive">Adicione/selecione uma comanda primeiro.</p>}
            {categories.map(c => {
              const prods = products.filter(p => p.isActive && p.categoryId === c.id).sort((a, b) => a.name.localeCompare(b.name));
              if (!prods.length) return null;
              return (
                <div key={c.id} className="mb-3">
                  <div className="mb-1 font-semibold">{c.name}</div>
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {prods.map(p => (
                      <Button key={p.id} variant="outline" size="sm" className="justify-between"
                        onClick={() => { handleProductClick(p); if (!needsAssembly(p)) setCatalogOpen(false); }}>
                        <span className="truncate">{p.name}</span>
                        <span className="text-xs">{formatCurrency(p.basePrice)}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
          </DialogContent>
        </Dialog>
      )}

      {assemblyProd && (() => {
        const a = getAssembly(assemblyProd.id) || {
          productId: assemblyProd.id, mode: 'fixed' as const,
          allowObservation: false, allowBorder: false, limitsByVariant: {}, defaultIngredientIds: [],
        };
        const ingForProduct = ingredients.filter(i =>
          i.categoryIds.length === 0 || (assemblyProd.categoryId && i.categoryIds.includes(assemblyProd.categoryId))
        );
        return (
          <AssemblyDialog
            open={!!assemblyProd}
            onOpenChange={(o) => { if (!o) { setAssemblyProd(null); setCatalogOpen(false); } }}
            product={assemblyProd}
            assembly={a}
            ingredients={ingForProduct}
            borders={borders}
            onConfirm={(item) => { launchAssembled(item); setAssemblyProd(null); setCatalogOpen(false); }}
          />
        );
      })()}

      {showPayment && (
        <PaymentDialog
          items={items.filter(i => i.status !== 'pago' && i.status !== 'cancelado')}
          tabs={tabs}
          onClose={() => setShowPayment(false)}
          onPay={async (selectedIds, paymentMethod) => {
            const selected = items.filter(i => selectedIds.includes(i.id));
            if (!selected.length) { toast.error('Selecione itens'); return; }
            const subtotal = selected.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
            const cartItems: CartItem[] = selected.map(i => ({
              productId: i.productId || '', name: i.name, code: i.code,
              price: i.unitPrice, quantity: i.quantity, image: i.image,
              ingredients: i.ingredients, removedIngredients: i.removedIngredients,
              border: i.border, observation: i.observation,
            }));
            try {
              const order = await createOrder.mutateAsync({
                storeId,
                customer: { name: `Mesa ${tableNumber ?? ''}`.trim(), cpfCnpj: '', whatsapp: '', cep: '', uf: '', city: '', neighborhood: '', address: '', number: '' },
                items: cartItems,
                subtotal,
                discount: 0,
                deliveryFee: 0,
                total: subtotal,
                paymentMethod: paymentMethod as any,
                deliveryShift: 'tarde' as any,
                observations: `Mesa ${tableNumber ?? ''}`,
                status: 'entregue' as any,
                origem: 'mesa',
              });
              await Promise.all(selected.map(i =>
                updateItem.mutateAsync({ id: i.id, status: 'pago', paidOrderId: order.id })
              ));
              toast.success('Pagamento registrado');
              setShowPayment(false);
              // Auto-close session when nothing remains
              const remaining = items.filter(i => i.status !== 'pago' && i.status !== 'cancelado' && !selectedIds.includes(i.id));
              if (remaining.length === 0) {
                await closeSession.mutateAsync(sessionId);
                toast.success('Mesa fechada');
                onClose();
              }
            } catch (e: any) { toast.error(e.message); }
          }}
        />
      )}
    </Dialog>
  );
}

function PaymentDialog({ items, tabs, onClose, onPay }: {
  items: TabItem[];
  tabs: { id: string; number: number; label?: string }[];
  onClose: () => void;
  onPay: (selectedIds: string[], paymentMethod: string) => void;
}) {
  const [mode, setMode] = useState<'comanda' | 'produto'>('comanda');
  const [selectedTabIds, setSelectedTabIds] = useState<string[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('dinheiro');

  const selectedIds = mode === 'comanda'
    ? items.filter(i => selectedTabIds.includes(i.tabId)).map(i => i.id)
    : selectedItemIds;

  const subtotal = items.filter(i => selectedIds.includes(i.id))
    .reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Pagamento</DialogTitle></DialogHeader>
        <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
          <TabsList>
            <TabsTrigger value="comanda">Por Comanda</TabsTrigger>
            <TabsTrigger value="produto">Por Produto</TabsTrigger>
          </TabsList>
          <TabsContent value="comanda" className="space-y-2">
            {tabs.map(t => {
              const tabItems = items.filter(i => i.tabId === t.id);
              const tot = tabItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
              if (!tabItems.length) return null;
              return (
                <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded border p-2">
                  <Checkbox checked={selectedTabIds.includes(t.id)}
                    onCheckedChange={(c) => setSelectedTabIds(c ? [...selectedTabIds, t.id] : selectedTabIds.filter(x => x !== t.id))} />
                  <div className="flex-1">Comanda {t.number}{t.label ? ` · ${t.label}` : ''} — {tabItems.length} itens</div>
                  <strong>{formatCurrency(tot)}</strong>
                </label>
              );
            })}
          </TabsContent>
          <TabsContent value="produto" className="space-y-1">
            {items.map(i => (
              <label key={i.id} className="flex cursor-pointer items-center gap-2 rounded border p-2 text-sm">
                <Checkbox checked={selectedItemIds.includes(i.id)}
                  onCheckedChange={(c) => setSelectedItemIds(c ? [...selectedItemIds, i.id] : selectedItemIds.filter(x => x !== i.id))} />
                <div className="flex-1">{i.quantity}x {i.name}</div>
                <strong>{formatCurrency(i.unitPrice * i.quantity)}</strong>
              </label>
            ))}
          </TabsContent>
        </Tabs>

        <div className="space-y-2 border-t pt-3">
          <Label>Forma de pagamento</Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dinheiro">Dinheiro</SelectItem>
              <SelectItem value="pix">PIX</SelectItem>
              <SelectItem value="cartao">Cartão</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-right text-lg">Total: <strong>{formatCurrency(subtotal)}</strong></div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onPay(selectedIds, paymentMethod)} disabled={selectedIds.length === 0}>
            Confirmar Pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}