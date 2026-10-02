import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Loader2, Search, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Filter = 'todos' | 'ABERTO' | 'VENCIDO' | 'PAGO';

const fmtDate = (d?: string | null) => (d ? d.split('-').reverse().join('/') : '-');
const todayStr = () => new Date().toISOString().slice(0, 10);

/** Situação calculada pela data de hoje (a view do ERP pode ter sido enviada ontem). */
function effectiveStatus(t: any): 'ABERTO' | 'VENCIDO' | 'PAGO' {
  if (t.status === 'PAGO' || t.data_quitacao) return 'PAGO';
  if (t.data_vencimento && t.data_vencimento < todayStr()) return 'VENCIDO';
  return 'ABERTO';
}

export default function TitlesPanel({ storeId, sellerCodes, customerCode, startDate, dateField = 'data_vencimento' }: {
  storeId: string;
  sellerCodes?: string[];
  customerCode?: string;
  startDate?: string;
  dateField?: 'data_emissao' | 'data_vencimento';
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');
  const [downloading, setDownloading] = useState<string | null>(null);

  const { data: titles = [], isLoading } = useQuery({
    queryKey: ['customer-titles', storeId, (sellerCodes || []).join(','), customerCode, startDate, dateField],
    queryFn: async () => {
      let q = supabase.from('customer_titles').select('*').eq('store_id', storeId)
        .order('data_vencimento', { ascending: true }).range(0, 9999);
      if (customerCode) q = q.eq('cliente_codigo', customerCode);
      if (startDate) q = q.gte(dateField, startDate);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const codes = useMemo(() => [...new Set(titles.map((t: any) => t.cliente_codigo).filter(Boolean))], [titles]);
  const { data: names = {} } = useQuery({
    queryKey: ['titles-customer-names', storeId, codes.length],
    enabled: codes.length > 0 && !customerCode,
    queryFn: async () => {
      const map: Record<string, { name: string; city: string }> = {};
      for (let i = 0; i < codes.length; i += 300) {
        const { data } = await supabase.from('customer_profiles').select('customer_code, name, city')
          .eq('store_id', storeId).in('customer_code', codes.slice(i, i + 300));
        (data || []).forEach((c) => { map[c.customer_code] = { name: c.name, city: c.city }; });
      }
      return map;
    },
  });

  const enriched = useMemo(() => titles.map((t: any) => ({ ...t, _st: effectiveStatus(t), _c: (names as any)[t.cliente_codigo] })), [titles, names]);
  const searched = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return enriched;
    return enriched.filter((t: any) => [t.cliente_codigo, t._c?.name, t._c?.city, t.codigo, t.nota_fiscal_numero, t.pedido_codigo]
      .some((v) => String(v || '').toLowerCase().includes(s)));
  }, [enriched, search]);
  const list = filter === 'todos' ? searched : searched.filter((t: any) => t._st === filter);

  const totals = (st: Filter) => {
    const l = searched.filter((t: any) => t._st === st);
    const v = l.reduce((a: number, t: any) => a + Number(st === 'PAGO' ? t.valor_pago || t.valor_total : t.valor_total - (t.valor_pago || 0)), 0);
    return { n: l.length, v };
  };
  const ab = totals('ABERTO'), ve = totals('VENCIDO'), pg = totals('PAGO');

  const download = async (t: any) => {
    setDownloading(t.id);
    try {
      const { data, error } = await supabase.from('customer_title_boletos').select('file_name, pdf_base64').eq('title_id', t.id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Boleto não disponível para este título');
      const bin = atob(data.pdf_base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = data.file_name || `boleto-${t.codigo}-${t.parcela}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao baixar boleto');
    } finally {
      setDownloading(null);
    }
  };

  const daysLate = (d: string) => Math.floor((Date.now() - new Date(d + 'T00:00:00').getTime()) / 86400000);

  return (
    <div className="space-y-4">
      {startDate && (
        <p className="text-xs text-muted-foreground">
          Exibindo títulos com {dateField === 'data_emissao' ? 'emissão' : 'vencimento'} a partir de {fmtDate(startDate)}.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {[{ t: 'Em aberto', s: ab, f: 'ABERTO' as Filter }, { t: 'Vencidos', s: ve, f: 'VENCIDO' as Filter }, { t: 'Pagos', s: pg, f: 'PAGO' as Filter }].map((k) => (
          <Card key={k.t} className="cursor-pointer" onClick={() => setFilter(k.f)}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{k.t} ({k.s.n})</p>
              <p className={`text-xl font-bold ${k.f === 'VENCIDO' ? 'text-destructive' : ''}`}>{formatCurrency(k.s.v)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder={customerCode ? 'Buscar por NF ou pedido' : 'Buscar por cliente, cidade, código ou NF'} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="ABERTO">Abertos</TabsTrigger>
          <TabsTrigger value="VENCIDO">Vencidos</TabsTrigger>
          <TabsTrigger value="PAGO">Pagos</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : list.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
          <Receipt className="h-8 w-8" />Nenhum título encontrado.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {list.map((t: any) => (
            <Card key={t.id}>
              <CardContent className="flex justify-between gap-3 p-4">
                <div className="min-w-0 text-sm">
                  {!customerCode && <p className="font-semibold uppercase">{t._c?.name || `Cliente ${t.cliente_codigo}`}</p>}
                  {!customerCode && t._c?.city && <p className="text-muted-foreground">{t._c.city}</p>}
                  <p className="text-muted-foreground">NF {t.codigo} • Parcela {t.parcela}{!customerCode ? ` • Cliente ${t.cliente_codigo}` : ''}</p>
                  <p className="text-muted-foreground">
                    Venc.: {fmtDate(t.data_vencimento)}
                    {t._st === 'VENCIDO' && t.data_vencimento && <span className="ml-1 font-semibold text-destructive">({daysLate(t.data_vencimento)} dias em atraso)</span>}
                    {t._st === 'PAGO' && <> • Pago em {fmtDate(t.data_quitacao)}</>}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end justify-between gap-2">
                  <Badge variant={t._st === 'VENCIDO' ? 'destructive' : t._st === 'PAGO' ? 'default' : 'outline'}>
                    {t._st === 'VENCIDO' ? 'Vencido' : t._st === 'PAGO' ? 'Pago' : 'Aberto'}
                  </Badge>
                  <p className="font-bold">{formatCurrency(Number(t.valor_total))}</p>
                  {t._st !== 'PAGO' && t.has_boleto && (
                    <Button size="sm" variant="outline" disabled={downloading === t.id} onClick={() => download(t)}>
                      {downloading === t.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />} Boleto
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
