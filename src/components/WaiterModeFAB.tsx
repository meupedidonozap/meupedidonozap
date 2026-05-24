import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const { cart, clearCart } = useCart();
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
      for (const it of cart.items) {
        const cartItem = it as CartItem;
        const subtotal = cartItem.price * cartItem.quantity;
        const order = await createOrder.mutateAsync({
          storeId: ws.storeId,
          customer,
          items: [cartItem],
          subtotal,
          discount: 0,
          deliveryFee: 0,
          total: subtotal,
          paymentMethod: '' as any,
          deliveryShift: 'tarde' as any,
          observations: `${obs}${cartItem.observation ? ` | ${cartItem.observation}` : ''}`,
          status: 'pendente' as any,
          origem: 'mesa',
        } as any);
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
      {/* Bottom CTA — covers existing "Ver Carrinho"/checkout buttons */}
      <div className="fixed inset-x-0 bottom-0 z-[70] border-t bg-card p-3 shadow-2xl">
        <Button
          className="h-14 w-full gap-2 bg-orange-600 text-base font-bold text-white hover:bg-orange-700"
          onClick={submit}
          disabled={submitting || totalItems === 0}
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShoppingCart className="h-5 w-5" />}
          {submitting
            ? 'Lançando…'
            : totalItems === 0
              ? 'Adicione itens para lançar'
              : `Lançar na Mesa (${totalItems} ${totalItems === 1 ? 'item' : 'itens'} • ${formatCurrency(cart.total)})`}
        </Button>
      </div>
    </>
  );
}