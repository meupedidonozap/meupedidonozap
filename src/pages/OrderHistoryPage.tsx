import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, Loader2, Pencil, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useStoreBySlug } from '@/hooks/useStores';
import { useAuth } from '@/hooks/useAuth';
import { useCustomerOrders } from '@/hooks/useCustomerProfile';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import { setEditingQuote } from '@/lib/quoteEditing';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const statusLabels: Record<string, { label: string; color: string }> = {
  orcamento: { label: 'Devolvido p/ ajuste', color: 'bg-amber-100 text-amber-800' },
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700' },
  liberado: { label: 'Liberado', color: 'bg-blue-100 text-blue-700' },
  confirmado: { label: 'Confirmado', color: 'bg-blue-100 text-blue-700' },
  preparando: { label: 'Preparando', color: 'bg-orange-100 text-orange-700' },
  enviado: { label: 'Enviado', color: 'bg-purple-100 text-purple-700' },
  entregue: { label: 'Entregue', color: 'bg-green-100 text-green-700' },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
};

export default function OrderHistoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: store, isLoading: storeLoading } = useStoreBySlug(slug || '');
  const { user, loading: authLoading } = useAuth();
  const { data: orders = [], isLoading: ordersLoading } = useCustomerOrders(user?.id, store?.id);
  const { setStoreId, clearCart, addItem } = useCart();
  const [editingId, setEditingId] = useState<string | null>(null);

  const editOrder = async (id: string) => {
    if (!store) return;
    setEditingId(id);
    try {
      const { data: order, error } = await supabase.from('orders').select('id, customer, items, status, xml_downloaded_at').eq('id', id).single();
      if (error) throw error;
      if (order.status !== 'orcamento') throw new Error('Este pedido não está mais disponível para edição');
      if (order.xml_downloaded_at) throw new Error('Pedido já transmitido: não pode ser editado');
      setStoreId(store.id);
      clearCart();
      for (const it of (order.items as any[]) || []) {
        if (it?.productId) addItem({ ...it, discountPercent: undefined });
      }
      setEditingQuote({ id: order.id, storeId: store.id, customerName: (order.customer as any)?.name || 'Meu pedido', byCustomer: true });
      toast.success('Pedido carregado no carrinho para edição');
      navigate(`/${store.slug}`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao abrir pedido');
    } finally {
      setEditingId(null);
    }
  };

  if (storeLoading || authLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!store) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Loja não encontrada</h1>
          <Button asChild className="mt-4"><Link to="/">Voltar</Link></Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Faça login para ver seus pedidos</h1>
          <Button asChild className="mt-4"><Link to={`/${store.slug}`}>Voltar à loja</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-card">
        <div className="container flex h-14 items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/${store.slug}`}><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <h1 className="font-bold">Meus Pedidos</h1>
        </div>
      </header>

      <main className="container py-6">
        {ordersLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center">
            <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum pedido encontrado</h3>
            <p className="text-muted-foreground">Você ainda não fez nenhum pedido nesta loja</p>
            <Button asChild className="mt-4"><Link to={`/${store.slug}`}>Ir às compras</Link></Button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order: any) => {
              const status = statusLabels[order.status] || { label: order.status, color: 'bg-muted text-muted-foreground' };
              const items = (order.items as any[]) || [];
              const editable = order.status === 'orcamento' && !order.xml_downloaded_at;
              return (
                <Card key={order.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold">Pedido #{order.order_number}</p>
                        <p className="text-sm text-muted-foreground">{formatDateTime(order.created_at)}</p>
                      </div>
                      <Badge className={status.color}>{status.label}</Badge>
                    </div>
                    {editable && (
                      <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>A empresa devolveu este pedido para ajuste. Edite os itens e finalize novamente.</span>
                      </div>
                    )}
                    <div className="mt-3 space-y-1 text-sm">
                      {items.map((item: any, i: number) => (
                        <div key={i} className="flex justify-between gap-2">
                          <div className="text-muted-foreground min-w-0">
                            <div>{item.quantity}x {item.name}</div>
                            {(item.size || item.color) && (
                              <div className="text-xs opacity-70 mt-0.5">
                                {item.size && <span>Tam: {item.size}</span>}
                                {item.size && item.color && <span className="mx-1">•</span>}
                                {item.color && <span>Cor: {item.color}</span>}
                              </div>
                            )}
                          </div>
                          <span className="shrink-0">{formatCurrency(item.price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex justify-between border-t pt-2 font-bold">
                      <span>Total</span>
                      <span>{formatCurrency(Number(order.total))}</span>
                    </div>
                    {editable && (
                      <Button className="mt-3 w-full" disabled={editingId === order.id} onClick={() => editOrder(order.id)}>
                        {editingId === order.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
                        Editar pedido
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
