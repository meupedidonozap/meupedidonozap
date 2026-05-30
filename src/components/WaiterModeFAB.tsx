import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, X, Loader2, Plus, Minus, Trash2, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useCart } from '@/contexts/CartContext';
import { useCreateOrder } from '@/hooks/useOrders';
import { useAddTabItem, useUpdateTabItem } from '@/hooks/useTables';
import { formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';
import type { CartItem } from '@/types';

export interface WaiterSession {
  sessionId: string;
  tabId: string;
  storeId: string;
  storeSlug: string;
  tableNumber: number;
  tabNumber: number;
  tabLabel?: string;
}

const STORAGE_KEY = 'waiter_session';

export function getWaiterSession(): WaiterSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WaiterSession;
  } catch { return null; }
}

export function setWaiterSession(s: WaiterSession) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function clearWaiterSession() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export default function WaiterModeFAB() {
  const [ws, setWs] = useState<WaiterSession | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const { cart, clearCart, updateQuantity, removeItem, updateItemObservation } = useCart();
  const createOrder = useCreateOrder();
  const addTabItem = useAddTabItem();
  const updateTabItem = useUpdateTabItem();
  const navigate = useNavigate();
  const location = useLocation();

  // Re-read on every route change (sessionStorage isn't reactive)
  useEffect(() => {
    setWs(getWaiterSession());
    const handler = () => setWs(getWaiterSession());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [location.pathname]);

  // Add top/bottom padding to body so sticky headers and bottom navs don't collide with our bars
  useEffect(() => {
    if (ws) {
      document.body.style.paddingTop = '48px';
      document.body.style.paddingBottom = '88px';
      return () => {
        document.body.style.paddingTop = '';
        document.body.style.paddingBottom = '';
      };
    }
  }, [ws]);

  const cancel = useCallback(() => {
    clearWaiterSession();
    clearCart();
    setWs(null);
    if (ws) navigate(`/${ws.storeSlug}/garcom`);
  }, [ws, navigate, clearCart]);

  const submit = useCallback(async () => {
    if (!ws) return;
    if (cart.items.length === 0) { toast.error('Adicione itens primeiro'); return; }
    setSubmitting(true);
    try {
      const obs = `Mesa ${ws.tableNumber} - Comanda ${ws.tabNumber}${ws.tabLabel ? ` (${ws.tabLabel})` : ''}`;
      const customer = {
        name: `MESA ${ws.tableNumber} · C${ws.tabNumber}${ws.tabLabel ? ` ${ws.tabLabel}` : ''}`.trim(),
        cpfCnpj: '', whatsapp: '', cep: '', uf: '', city: '', neighborhood: '', address: '', number: '',
      } as any;
      // Cria UM ÚNICO pedido com todos os itens do carrinho (1 impressão só)
      const cartItems = cart.items as CartItem[];
      const subtotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
      const order = await createOrder.mutateAsync({
        storeId: ws.storeId,
        customer,
        items: cartItems,
        subtotal,
        discount: 0,
        deliveryFee: 0,
        total: subtotal,
        paymentMethod: '' as any,
        deliveryShift: 'tarde' as any,
        observations: obs,
        status: 'pendente' as any,
        origem: 'mesa',
      } as any);
      // Espelha cada item na comanda da mesa, vinculando ao mesmo pedido
      for (const cartItem of cartItems) {
        const tabItem = await addTabItem.mutateAsync({
          tabId: ws.tabId,
          productId: cartItem.productId,
          variantId: cartItem.variantId,
          name: cartItem.name + (cartItem.size ? ` ${cartItem.size}` : ''),
          code: cartItem.code || '',
          unitPrice: cartItem.price,
          quantity: cartItem.quantity,
          ingredients: cartItem.ingredients || [],
          removedIngredients: cartItem.removedIngredients || [],
          border: cartItem.border,
          observation: cartItem.observation,
          image: cartItem.image,
        } as any);
        if (order && tabItem) {
          await updateTabItem.mutateAsync({ id: tabItem.id, paidOrderId: order.id });
        }
      }
      toast.success('Pedido lançado na mesa!');
      clearCart();
      setReviewOpen(false);
      clearWaiterSession();
      setWs(null);
      navigate(`/${ws.storeSlug}/garcom`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao lançar');
    } finally {
      setSubmitting(false);
    }
  }, [ws, cart.items, createOrder, addTabItem, updateTabItem, clearCart, navigate]);

  if (!ws) return null;

  const totalItems = cart.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <>
      {/* Top banner */}
      <div className="fixed left-0 right-0 top-0 z-[70] bg-orange-600 text-white shadow-md">
        <div className="container flex h-12 items-center justify-between gap-2 text-sm">
          <div className="font-semibold">
            🍽 Modo Garçom — MESA {ws.tableNumber} · C{ws.tabNumber}
            {ws.tabLabel ? ` (${ws.tabLabel})` : ''}
          </div>
          <Button size="sm" variant="ghost" className="h-8 gap-1 text-white hover:bg-white/10" onClick={cancel}>
            <X className="h-4 w-4" /> Sair
          </Button>
        </div>
      </div>
      {/* Bottom CTA — opens review sheet before launching */}
      <div className="fixed inset-x-0 bottom-0 z-[70] border-t bg-card p-3 shadow-2xl">
        <Button
          className="h-14 w-full gap-2 bg-orange-600 text-base font-bold text-white hover:bg-orange-700"
          onClick={() => totalItems > 0 && setReviewOpen(true)}
          disabled={submitting || totalItems === 0}
        >
          <ClipboardList className="h-5 w-5" />
          {totalItems === 0
            ? 'Adicione itens para revisar'
            : `Revisar Pedido (${totalItems} ${totalItems === 1 ? 'item' : 'itens'} • ${formatCurrency(cart.total)})`}
        </Button>
      </div>

      {/* Review sheet */}
      <Sheet open={reviewOpen} onOpenChange={setReviewOpen}>
        <SheetContent side="bottom" className="flex h-[90dvh] flex-col p-0">
          <SheetHeader className="border-b p-4">
            <SheetTitle>
              Revisar pedido — MESA {ws.tableNumber} · C{ws.tabNumber}
              {ws.tabLabel ? ` (${ws.tabLabel})` : ''}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-3">
            {cart.items.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Carrinho vazio.</p>
            ) : (
              <div className="space-y-2">
                {cart.items.map((it) => {
                  const lineTotal = it.price * it.quantity;
                  return (
                    <div key={`${it.productId}-${it.variantId || ''}-${(it.observation || '').slice(0,6)}`} className="rounded-lg border bg-card p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium leading-tight">{it.name}{it.size ? ` ${it.size}` : ''}</p>
                          {(it.ingredients?.length || 0) > 0 && (
                            <p className="text-xs text-muted-foreground">+ {it.ingredients!.map(x => x.name).join(', ')}</p>
                          )}
                          {(it.removedIngredients?.length || 0) > 0 && (
                            <p className="text-xs text-muted-foreground">SEM {it.removedIngredients!.map(x => x.name).join(', ')}</p>
                          )}
                          {it.border && <p className="text-xs">Borda: {it.border.name}</p>}
                          <p className="mt-1 text-sm text-muted-foreground">{formatCurrency(it.price)} un.</p>
                        </div>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0"
                          onClick={() => removeItem(it.productId, it.variantId)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Button size="icon" variant="outline" className="h-8 w-8"
                            onClick={() => updateQuantity(it.productId, it.quantity - 1, it.variantId)}>
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center font-semibold">{it.quantity}</span>
                          <Button size="icon" variant="outline" className="h-8 w-8"
                            onClick={() => updateQuantity(it.productId, it.quantity + 1, it.variantId)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <span className="font-semibold">{formatCurrency(lineTotal)}</span>
                      </div>
                      <Textarea
                        className="mt-2 min-h-[40px] text-xs"
                        placeholder="Observação do item (opcional)…"
                        value={it.observation || ''}
                        onChange={(e) => updateItemObservation(it.productId, e.target.value, it.variantId)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="border-t bg-card p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="text-lg font-bold">{formatCurrency(cart.total)}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setReviewOpen(false)}>
                Continuar adicionando
              </Button>
              <Button
                className="flex-1 bg-orange-600 font-bold text-white hover:bg-orange-700"
                onClick={submit}
                disabled={submitting || totalItems === 0}
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
                {submitting ? 'Lançando…' : 'Lançar na Mesa'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}