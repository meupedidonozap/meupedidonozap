import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MessageCircle, Trash2, Bell } from 'lucide-react';
import { toast } from 'sonner';

export function buildWishlistMessage(productName: string) {
  return `Olá, o produto "${productName}" que você queria já está disponível para compra.`;
}

export function WishlistPanel({ storeId, slug }: { storeId: string; slug: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['product-wishlist', storeId],
    queryFn: async () => {
      const { data, error } = await supabase.from('product_wishlist').select('*').eq('store_id', storeId).order('created_at', { ascending: false }).limit(1000);
      if (error) throw error;
      const ids = [...new Set((data || []).map(r => r.product_id))];
      const { data: prods } = ids.length ? await supabase.from('products').select('id, stock').in('id', ids) : { data: [] as any[] };
      const stock = new Map((prods || []).map((p: any) => [p.id, Number(p.stock) || 0]));
      return (data || []).map(r => ({ ...r, stock: stock.get(r.product_id) ?? 0 }));
    },
  });
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r: any) => `${r.product_name} ${r.product_code} ${r.customer_name} ${r.email} ${r.whatsapp}`.toLowerCase().includes(q)) : rows;
  }, [rows, search]);

  const sendWhats = async (r: any) => {
    const digits = String(r.whatsapp || '').replace(/\D/g, '');
    if (!digits) { toast.error('Cliente sem WhatsApp.'); return; }
    const phone = digits.startsWith('55') ? digits : `55${digits}`;
    const link = `${window.location.origin}/${slug}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`${buildWishlistMessage(r.product_name)}\n${link}`)}`, '_blank');
    await supabase.from('product_wishlist').update({ whatsapp_sent_at: new Date().toISOString() }).eq('id', r.id);
    qc.invalidateQueries({ queryKey: ['product-wishlist', storeId] });
  };
  const sendPush = async (r: any) => {
    const { data, error } = await supabase.functions.invoke('notify-wishlist', { body: { product_id: r.product_id } });
    if (error) { toast.error('Falha ao enviar notificação.'); return; }
    toast.success((data as any)?.reason === 'sem estoque' ? 'Produto ainda sem estoque.' : `Notificações enviadas: ${(data as any)?.sent ?? 0}`);
    qc.invalidateQueries({ queryKey: ['product-wishlist', storeId] });
  };
  const remove = async (id: string) => {
    if (!confirm('Remover este pedido da lista?')) return;
    await supabase.from('product_wishlist').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['product-wishlist', storeId] });
  };
  const fmt = (d?: string | null) => d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';

  return (
    <Card>
      <CardHeader><CardTitle>Lista de Desejos ({rows.length})</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Input placeholder="Buscar produto ou cliente..." value={search} onChange={e => setSearch(e.target.value)} />
        {isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cliente pediu aviso ainda.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((r: any) => (
              <div key={r.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{r.product_code ? `${r.product_code} - ` : ''}{r.product_name}</p>
                  <p className="text-muted-foreground">{r.customer_name} {r.whatsapp ? `• ${r.whatsapp}` : ''} {r.email ? `• ${r.email}` : ''}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant={r.stock > 0 ? 'default' : 'destructive'}>{r.stock > 0 ? `Disponível (${r.stock})` : 'Esgotado'}</Badge>
                    <Badge variant="outline">Pedido em {fmt(r.created_at)}</Badge>
                    {r.push_notified_at && <Badge variant="secondary">Notificado {fmt(r.push_notified_at)}</Badge>}
                    {r.whatsapp_sent_at && <Badge variant="secondary">WhatsApp {fmt(r.whatsapp_sent_at)}</Badge>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={() => sendWhats(r)} disabled={!r.whatsapp}><MessageCircle className="mr-1 h-4 w-4" /> WhatsApp</Button>
                  <Button size="sm" variant="outline" onClick={() => sendPush(r)} disabled={r.stock <= 0} title="Enviar notificação"><Bell className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
