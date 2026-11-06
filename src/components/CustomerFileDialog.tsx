import { useQuery } from '@tanstack/react-query';
import { Loader2, MapPin, Navigation, Phone } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

export interface CustomerFileData {
  name: string; customer_code: string; cpf_cnpj: string; whatsapp: string;
  address: string; number: string; neighborhood: string; city: string; uf: string; cep: string;
  seller_code: string; price_table: number; geo_lat: number | null; geo_lng: number | null;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function CustomerFileDialog({ customer, storeId, onClose }: { customer: CustomerFileData | null; storeId: string; onClose: () => void }) {
  const code = customer?.customer_code?.trim() || '';
  const { data: fin, isLoading } = useQuery({
    queryKey: ['customer-file-fin', storeId, code],
    enabled: !!customer && !!code,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('customer_titles')
        .select('valor_saldo, valor_total, valor_pago, valor_pago_liquido, data_vencimento, status, data_quitacao')
        .eq('store_id', storeId).eq('cliente_codigo', code).limit(2000);
      if (error) throw error;
      const today = new Date().toISOString().slice(0, 10);
      const r = { venc: { n: 0, v: 0 }, aVencer: { n: 0, v: 0 }, pagos: { n: 0, v: 0 } };
      for (const t of (data || []) as any[]) {
        if (t.status === 'PAGO' || t.data_quitacao) { r.pagos.n++; r.pagos.v += Number(t.valor_pago_liquido ?? t.valor_pago ?? t.valor_total ?? 0); continue; }
        const saldo = Number(t.valor_saldo ?? (Number(t.valor_total) - Number(t.valor_pago || 0)));
        if (saldo <= 0) continue;
        const b = t.data_vencimento && t.data_vencimento < today ? r.venc : r.aVencer;
        b.n++; b.v += saldo;
      }
      return r;
    },
  });
  if (!customer) return null;
  const c = customer;
  const addr = [[c.address, c.number].filter(Boolean).join(', '), c.neighborhood, [c.city, c.uf].filter(Boolean).join('/'), c.cep].filter(Boolean).join(' - ');
  const hasGeo = c.geo_lat != null && c.geo_lng != null;
  const q = encodeURIComponent(addr + ' - Brasil');
  const gmaps = hasGeo ? `https://www.google.com/maps/dir/?api=1&destination=${c.geo_lat},${c.geo_lng}` : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  const waze = hasGeo ? `https://waze.com/ul?ll=${c.geo_lat},${c.geo_lng}&navigate=yes` : `https://waze.com/ul?q=${q}&navigate=yes`;
  const phone = (c.whatsapp || '').replace(/\D/g, '');
  const Row = ({ l, v }: { l: string; v?: string | number | null }) => (
    <div className="flex justify-between gap-3 text-sm"><span className="text-muted-foreground">{l}</span><span className="text-right font-medium">{v || '—'}</span></div>
  );
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Ficha do cliente</DialogTitle></DialogHeader>
        <section className="space-y-1.5">
          <p className="font-semibold">{c.name}</p>
          <Row l="Código" v={c.customer_code} />
          <Row l="CPF/CNPJ" v={c.cpf_cnpj} />
          <Row l="Vendedor" v={c.seller_code} />
          <Row l="Tabela de preço" v={c.price_table} />
          <div className="flex justify-between gap-3 text-sm"><span className="text-muted-foreground">WhatsApp</span>
            {phone ? <a className="font-medium text-primary underline" href={`https://wa.me/${phone.length <= 11 ? '55' + phone : phone}`} target="_blank" rel="noreferrer"><Phone className="inline h-3 w-3 mr-1" />{c.whatsapp}</a> : <span>—</span>}
          </div>
        </section>
        <section className="space-y-2 border-t pt-3">
          <p className="text-sm font-semibold flex items-center gap-1"><MapPin className="h-4 w-4" /> Endereço</p>
          <p className="text-sm">{addr || 'Endereço não cadastrado'}</p>
          {(addr || hasGeo) && (
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline" size="sm"><a href={gmaps} target="_blank" rel="noreferrer"><Navigation className="mr-1 h-4 w-4" />Google Maps</a></Button>
              <Button asChild variant="outline" size="sm"><a href={waze} target="_blank" rel="noreferrer"><Navigation className="mr-1 h-4 w-4" />Waze</a></Button>
            </div>
          )}
        </section>
        <section className="space-y-2 border-t pt-3">
          <p className="text-sm font-semibold">Resumo financeiro</p>
          {!code ? <p className="text-sm text-muted-foreground">Cliente sem código no ERP.</p>
            : isLoading ? <Loader2 className="h-4 w-4 animate-spin" />
            : fin && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md border border-destructive/40 p-2"><p className="text-xs text-muted-foreground">Vencidos</p><p className="text-sm font-bold text-destructive">{brl(fin.venc.v)}</p><p className="text-xs">{fin.venc.n} títulos</p></div>
                <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">A vencer</p><p className="text-sm font-bold">{brl(fin.aVencer.v)}</p><p className="text-xs">{fin.aVencer.n} títulos</p></div>
                <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Pagos</p><p className="text-sm font-bold text-primary">{brl(fin.pagos.v)}</p><p className="text-xs">{fin.pagos.n} títulos</p></div>
              </div>
            )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
