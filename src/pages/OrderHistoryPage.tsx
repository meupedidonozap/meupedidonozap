import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, Loader2 } from 'lucide-react';
import { useStoreBySlug } from '@/hooks/useStores';
import { useAuth } from '@/hooks/useAuth';
import { useCustomerOrders } from '@/hooks/useCustomerProfile';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { OrderStatus } from '@/types';

const statusLabels: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700' },
  confirmado: { label: 'Confirmado', color: 'bg-blue-100 text-blue-700' },
  preparando: { label: 'Preparando', color: 'bg-orange-100 text-orange-700' },
  enviado: { label: 'Enviado', color: 'bg-purple-100 text-purple-700' },
  entregue: { label: 'Entregue', color: 'bg-green-100 text-green-700' },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
};

export default function OrderHistoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: store, isLoading: storeLoading } = useStoreBySlug(slug || '');
  const { user, loading: authLoading } = useAuth();
  const { data: orders = [], isLoading: ordersLoading } = useCustomerOrders(user?.id, store?.id);

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
              const status = statusLabels[order.status] || statusLabels.pendente;
              const items = (order.items as any[]) || [];
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
                    <div className="mt-3 space-y-1 text-sm">
                      {items.map((item: any, i: number) => (
                        <div key={i} className="flex justify-between">
                          <span className="text-muted-foreground">{item.quantity}x {item.name}</span>
                          <span>{formatCurrency(item.price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex justify-between border-t pt-2 font-bold">
                      <span>Total</span>
                      <span>{formatCurrency(Number(order.total))}</span>
                    </div>
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
