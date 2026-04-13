import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Flame, CheckCircle2, Clock, Globe, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface KitchenOrder {
  id: string;
  order_number: number;
  customer: { name?: string; phone?: string };
  items: any;
  total: number;
  status: string;
  origem: string;
  observations: string | null;
  created_at: string;
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const { toast } = useToast();

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, customer, items, total, status, origem, observations, created_at')
      .in('status', ['pendente', 'em_preparacao'])
      .order('created_at', { ascending: true });
    if (!error && data) setOrders(data as KitchenOrder[]);
  };

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel('kitchen-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: newStatus === 'em_preparacao' ? 'Preparo iniciado!' : 'Pedido pronto!' });
    }
  };

  const renderItems = (items: any) => {
    if (Array.isArray(items)) {
      return items.map((it: any, i: number) => (
        <div key={i} className="text-zinc-300 text-lg">
          {it.quantity ? `${it.quantity}x ` : ''}{it.name || it.description || JSON.stringify(it)}
        </div>
      ));
    }
    if (typeof items === 'object' && items?.description) {
      return <div className="text-zinc-300 text-lg">{items.description}</div>;
    }
    return <div className="text-zinc-300 text-lg">{String(items)}</div>;
  };

  const timeSince = (date: string) => {
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `${mins}min`;
    return `${Math.floor(mins / 60)}h${mins % 60}min`;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
          <Flame className="text-orange-500 w-8 h-8" /> Cozinha
        </h1>
        <Badge variant="outline" className="text-lg border-zinc-700 text-zinc-400">
          {orders.length} pedido{orders.length !== 1 ? 's' : ''}
        </Badge>
      </header>

      {orders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-32 text-zinc-500 text-xl">
          <CheckCircle2 className="w-16 h-16 mb-4" />
          Nenhum pedido pendente
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {orders.map((order) => (
          <Card
            key={order.id}
            className={`border-2 bg-zinc-900 ${
              order.status === 'em_preparacao'
                ? 'border-orange-500 shadow-lg shadow-orange-500/20'
                : 'border-zinc-700'
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-bold text-zinc-100">
                  #{order.order_number}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {order.origem === 'whatsapp' ? (
                    <Badge className="bg-green-600 text-white gap-1">
                      <MessageCircle className="w-3 h-3" /> WhatsApp
                    </Badge>
                  ) : (
                    <Badge className="bg-blue-600 text-white gap-1">
                      <Globe className="w-3 h-3" /> Web
                    </Badge>
                  )}
                  <Badge
                    className={
                      order.status === 'em_preparacao'
                        ? 'bg-orange-600 text-white'
                        : 'bg-yellow-600 text-white'
                    }
                  >
                    {order.status === 'em_preparacao' ? 'Preparando' : 'Pendente'}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-zinc-400 mt-1">
                <span>{order.customer?.name || 'Cliente'}</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {timeSince(order.created_at)}
                </span>
              </div>
            </CardHeader>

            <CardContent className="space-y-1 pb-3">
              {renderItems(order.items)}
              {order.observations && (
                <div className="mt-2 text-sm text-yellow-400 italic">
                  Obs: {order.observations}
                </div>
              )}
              <div className="text-right text-xl font-bold text-zinc-100 mt-2">
                R$ {Number(order.total).toFixed(2)}
              </div>
            </CardContent>

            <CardFooter className="gap-2">
              {order.status === 'pendente' && (
                <Button
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white text-lg py-6"
                  onClick={() => updateStatus(order.id, 'em_preparacao')}
                >
                  <Flame className="w-5 h-5 mr-2" /> Iniciar Preparo
                </Button>
              )}
              {order.status === 'em_preparacao' && (
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white text-lg py-6"
                  onClick={() => updateStatus(order.id, 'pronto')}
                >
                  <CheckCircle2 className="w-5 h-5 mr-2" /> Pedido Pronto
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
