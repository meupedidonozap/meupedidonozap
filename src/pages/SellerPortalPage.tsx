import { useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Search, Plus, TrendingUp, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useStoreBySlug } from '@/hooks/useStores';
import { useSellerMode } from '@/hooks/useSellerMode';
import { useSellerContext } from '@/contexts/SellerContext';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CheckinDialog from '@/components/CheckinDialog';
import SellerMenu from '@/components/SellerMenu';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { WifiOff, RefreshCw } from 'lucide-react';
import { DEFAULT_VISIT_REASONS } from '@/hooks/useCustomerVisits';
import { Pencil, Share2 } from 'lucide-react';
import { shareOrderPdf } from '@/lib/shareOrderPdf';
import { useCart } from '@/contexts/CartContext';
import { mapProfile } from '@/hooks/useCustomerProfile';
import { setEditingQuote } from '@/lib/quoteEditing';
import TitlesPanel from '@/components/TitlesPanel';
import InvoicesPanel from '@/components/InvoicesPanel';
import ErpOrdersPanel from '@/components/ErpOrdersPanel';

type Section = 'atendimento' | 'vendas' | 'resultados' | 'notas' | 'titulos';
const TITLES: Record<Section, string> = {
  atendimento: 'Atendimento', vendas: 'Vendas', resultados: 'Resultados', notas: 'Notas Fiscais', titulos: 'Títulos',
};

export function sellerOrderStage(status: string): { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' } {
  if (status === 'orcamento') return { label: 'Orçamento', variant: 'outline' };
  if (status === 'cancelado') return { label: 'Cancelado', variant: 'destructive' };
  if (status === 'enviado' || status === 'entregue') return { label: 'Faturado', variant: 'default' };
  if (status === 'liberado_transmissao' || status === 'confirmado' || status === 'preparando') return { label: 'Separado', variant: 'secondary' };
  return { label: 'Não Faturado', variant: 'outline' };
}

export default function SellerPortalPage() {
  const { slug, section: rawSection } = useParams<{ slug: string; section: string }>();
  const section = (rawSection && rawSection in TITLES ? rawSection : 'vendas') as Section;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: store, isLoading } = useStoreBySlug(slug || '');
  const seller = useSellerMode(store?.id);
  const { selectCustomer } = useSellerContext();
  const { setStoreId: setCartStore, clearCart, addItem } = useCart();
  const [search, setSearch] = useState('');

  const codes = seller.isAdmin ? [] : seller.sellerCodes;
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['seller-orders', store?.id, codes.join(',')],
    enabled: !!store?.id && seller.canSell,
    queryFn: async () => {
      let q = supabase.from('orders').select('id, order_number, customer, total, status, created_at')
        .eq('store_id', store!.id).order('created_at', { ascending: false }).range(0, 4999);
      if (codes.length) q = q.in('customer->>sellerCode', codes);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { queue, syncing, sync } = useOfflineQueue(store?.id);
  const online = useOnlineStatus();
  const allOrders = useMemo(() => {
    const local = queue.map((q) => ({
      id: `local-${q.id}`, order_number: null, customer: q.payload.customer, total: q.total,
      status: q.payload.status, created_at: q.createdAt, _offline: true, _error: q.status === 'error',
    }));
    return [...local, ...orders];
  }, [queue, orders]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return allOrders;
    return allOrders.filter((o: any) => {
      const c = o.customer || {};
      return [c.name, c.city, c.customerCode, String(o.order_number)].some(v => String(v || '').toLowerCase().includes(s));
    });
  }, [allOrders, search]);
  const quotes = filtered.filter((o: any) => o.status === 'orcamento');
  const realOrders = filtered.filter((o: any) => o.status !== 'orcamento');
  const sum = (list: any[]) => list.reduce((a, o) => a + Number(o.total || 0), 0);

  const setStatus = async (id: string, status: 'pendente' | 'cancelado') => {
    const { error } = await supabase.from('orders').update({ status }).eq('id', id).select().single();
    if (error) { toast.error(error.message); return; }
    toast.success(status === 'pendente' ? 'Orçamento finalizado como pedido' : 'Orçamento cancelado');
    qc.invalidateQueries({ queryKey: ['seller-orders'] });
  };

  const [sharingId, setSharingId] = useState<string | null>(null);
  const share = async (id: string) => {
    if (!store) return;
    setSharingId(id);
    try { await shareOrderPdf(id, store.name); }
    catch (e: any) { toast.error(e.message || 'Não foi possível gerar o PDF'); }
    finally { setSharingId(null); }
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const editQuote = async (id: string) => {
    if (!store) return;
    setEditingId(id);
    try {
      const { data: order, error } = await supabase.from('orders').select('id, customer, items, status').eq('id', id).single();
      if (error) throw error;
      if (order.status !== 'orcamento') throw new Error('Este orçamento já foi finalizado');
      const c: any = order.customer || {};
      let profile: any = null;
      if (c.customerCode) {
        const { data } = await supabase.from('customer_profiles').select('*').eq('store_id', store.id).eq('customer_code', c.customerCode).limit(1);
        profile = data?.[0];
      }
      if (!profile && c.cpfCnpj) {
        const { data } = await supabase.from('customer_profiles').select('*').eq('store_id', store.id).eq('cpf_cnpj', c.cpfCnpj).limit(1);
        profile = data?.[0];
      }
      if (!profile) throw new Error('Cliente do orçamento não encontrado no cadastro');
      selectCustomer({ ...mapProfile(profile), customerCode: profile.customer_code || undefined });
      setCartStore(store.id);
      clearCart();
      for (const it of (order.items as any[]) || []) {
        if (it?.productId) addItem({ ...it, discountPercent: undefined });
      }
      setEditingQuote({ id: order.id, storeId: store.id, customerName: profile.name });
      toast.success('Orçamento carregado no carrinho para edição');
      navigate(`/${store.slug}`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao abrir orçamento');
    } finally {
      setEditingId(null);
    }
  };

  if (isLoading || seller.loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!store || !seller.canSell) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-bold">Acesso exclusivo para vendedores</h1>
        <Button asChild><Link to={`/${slug}`}>Voltar à loja</Link></Button>
      </div>
    );
  }

  const OrderCard = ({ o, quote }: { o: any; quote?: boolean }) => {
    const c = o.customer || {};
    const stage = sellerOrderStage(o.status);
    return (
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex justify-between gap-3">
            <div className="min-w-0 text-sm">
              <p className="font-semibold uppercase">{c.name}</p>
              <p className="text-muted-foreground">{[c.city, c.uf].filter(Boolean).join(' - ')}</p>
              <p className="text-muted-foreground">Cód: {o._offline ? 'AGUARDANDO REDE' : quote ? 'ORÇAMENTO' : `#${o.order_number}`}{c.customerCode ? ` • Cliente ${c.customerCode}` : ''}</p>
              <p className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString('pt-BR')}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {o._offline
                ? <Badge variant="destructive" className="gap-1"><WifiOff className="h-3 w-3" /> OFFLINE — Não Integrado</Badge>
                : <Badge variant={stage.variant}>{stage.label}</Badge>}
              <p className="font-bold">{formatCurrency(Number(o.total))}</p>
            </div>
          </div>
          {!o._offline && (
            <div className="grid grid-cols-2 gap-2 border-t pt-3 sm:flex sm:justify-end">
              <Button size="sm" variant="secondary" className="col-span-2 w-full sm:w-auto" disabled={sharingId === o.id} onClick={() => share(o.id)}>
                {sharingId === o.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Share2 className="mr-1 h-4 w-4" />}
                Imprimir / Enviar PDF
              </Button>
              {quote && (<>
                <Button size="sm" variant="outline" className="w-full sm:w-auto" disabled={editingId === o.id} onClick={() => editQuote(o.id)}>
                  {editingId === o.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Pencil className="mr-1 h-4 w-4" />} Editar
                </Button>
                <Button size="sm" className="w-full sm:w-auto" onClick={() => setStatus(o.id, 'pendente')}><CheckCircle2 className="mr-1 h-4 w-4" /> Finalizar</Button>
                <Button size="sm" variant="ghost" className="col-span-2 w-full text-destructive sm:w-auto" onClick={() => setStatus(o.id, 'cancelado')}><XCircle className="mr-1 h-4 w-4" /> Cancelar</Button>
              </>)}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const now = new Date();
  const monthOrders = orders.filter((o: any) => {
    const d = new Date(o.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const mOrders = monthOrders.filter((o: any) => !['orcamento', 'cancelado'].includes(o.status));
  const mQuotes = monthOrders.filter((o: any) => o.status === 'orcamento');
  const mBilled = mOrders.filter((o: any) => sellerOrderStage(o.status).label === 'Faturado');

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 border-b bg-card">
        <div className="container flex h-14 items-center gap-2">
          <Button variant="ghost" size="icon" asChild><Link to={`/${store.slug}`}><ArrowLeft className="h-5 w-5" /></Link></Button>
          <SellerMenu store={store} sellerName={seller.sellerName} />
          <h1 className="font-bold">{TITLES[section]}</h1>
        </div>
      </header>

      <main className="container py-4 pb-28">
        {section === 'vendas' && (
          <Tabs defaultValue="orcamentos">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="orcamentos">Orçamentos</TabsTrigger>
              <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
            </TabsList>
            <div className="relative my-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Pesquisar cliente, cidade, código..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {queue.length > 0 && (
              <div className="mb-3 flex items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <span className="flex items-center gap-2"><WifiOff className="h-4 w-4" /> {queue.length} registro(s) salvos no aparelho, ainda não integrados.</span>
                <Button size="sm" variant="outline" disabled={!online || syncing} onClick={() => sync()}>
                  <RefreshCw className={`mr-1 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} /> Sincronizar agora
                </Button>
              </div>
            )}
            {ordersLoading && queue.length === 0 && online ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
              <>
                <TabsContent value="orcamentos" className="space-y-2">
                  <p className="text-right text-xs text-muted-foreground">{quotes.length} Orçamentos<br />{formatCurrency(sum(quotes))}</p>
                  {quotes.length === 0 && <p className="py-8 text-center text-muted-foreground">Nenhum orçamento salvo.</p>}
                  {quotes.map((o: any) => <OrderCard key={o.id} o={o} quote />)}
                </TabsContent>
                <TabsContent value="pedidos" className="space-y-2">
                  {store.slug === 'dicolore' ? (
                    <ErpOrdersPanel storeId={store.id} localOrders={allOrders.filter((o: any) => !['orcamento', 'cancelado'].includes(o.status))} />
                  ) : (
                    <>
                      <p className="text-right text-xs text-muted-foreground">{realOrders.length} Pedidos<br />{formatCurrency(sum(realOrders))}</p>
                      {realOrders.length === 0 && <p className="py-8 text-center text-muted-foreground">Nenhum pedido encontrado.</p>}
                      {realOrders.map((o: any) => <OrderCard key={o.id} o={o} />)}
                    </>
                  )}
                </TabsContent>
              </>
            )}
            <Button size="icon" className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-accent text-accent-foreground shadow-lg hover:bg-accent/90"
              onClick={() => navigate(`/${store.slug}`)} aria-label="Novo pedido">
              <Plus className="h-6 w-6" />
            </Button>
          </Tabs>
        )}

        {section === 'resultados' && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { t: 'Pedidos do mês', v: String(mOrders.length) },
              { t: 'Total vendido no mês', v: formatCurrency(sum(mOrders)) },
              { t: 'Faturado no mês', v: formatCurrency(sum(mBilled)) },
              { t: 'Orçamentos em aberto', v: `${mQuotes.length} • ${formatCurrency(sum(mQuotes))}` },
            ].map(k => (
              <Card key={k.t}><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><TrendingUp className="h-4 w-4" />{k.t}</CardTitle></CardHeader>
                <CardContent className="text-2xl font-bold">{k.v}</CardContent></Card>
            ))}
          </div>
        )}

        {section === 'titulos' && (
          <TitlesPanel
            storeId={store.id}
            sellerCodes={codes}
            startDate={store.settings.titlesStartDate}
            dateField={store.settings.titlesDateField}
          />
        )}

        {section === 'notas' && (
          <InvoicesPanel storeId={store.id} startDate={store.settings.titlesStartDate} />
        )}

        {section === 'atendimento' && (
          <CheckinDialog
            open
            onOpenChange={(o) => { if (!o) navigate(`/${store.slug}`); }}
            storeId={store.id}
            sellerCodes={codes}
            unvisitedPeriodDays={Number((store.settings as any)?.unvisitedPeriodDays) || 30}
            visitReasons={((store.settings as any)?.visitReasons as string[])?.length ? (store.settings as any).visitReasons : DEFAULT_VISIT_REASONS}
            maxDistanceMeters={Number((store.settings as any)?.maxCheckinDistanceMeters) || 300}
            onCustomerSelected={(c) => { selectCustomer(c); }}
          />
        )}
      </main>
    </div>
  );
}
