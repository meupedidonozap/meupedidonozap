import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History, Search } from 'lucide-react';

type Entity = 'order' | 'customer';

const ACTIONS: Record<string, string> = {
  criacao: 'Criação', edicao: 'Edição', finalizacao: 'Finalização', status: 'Status',
  cancelamento: 'Cancelamento', exclusao: 'Exclusão', integracao_erp: 'Integração ERP',
  tabela: 'Tabela de preço', vendedor: 'Vendedor', desconto: 'Desconto',
};

const brl = (v: unknown) => v == null ? '-' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const arrow = (a: unknown, b: unknown, f: (v: unknown) => string = (v) => String(v ?? '-')) =>
  a === b ? f(b) : `${f(a)} → ${f(b)}`;

function describe(entity: Entity, action: string, d: Record<string, any>): string {
  if (entity === 'order') {
    if (action === 'criacao' || action === 'exclusao')
      return `Status ${d.status} • ${d.itens} itens • Qtd ${d.quantidade} • ${brl(d.total)}`;
    const parts = [
      `Status ${arrow(d.status_de, d.status_para)}`,
      `Itens ${arrow(d.itens_de, d.itens_para)}`,
      `Qtd ${arrow(Number(d.quantidade_de), Number(d.quantidade_para))}`,
      `Total ${arrow(Number(d.total_de), Number(d.total_para), brl)}`,
    ];
    if (d.cliente_de !== d.cliente_para) parts.push(`Cliente ${d.cliente_de} → ${d.cliente_para}`);
    if (d.erp) parts.push(`ERP ${d.erp}`);
    return parts.join(' • ');
  }
  switch (action) {
    case 'criacao': return `Tabela ${d.tabela ?? '-'} • Código ${d.codigo || 'PROSPECT'} • Vendedor ${d.vendedor || '-'}`;
    case 'tabela': return `Tabela ${d.de ?? '-'} → ${d.para ?? '-'}`;
    case 'vendedor': return `Vendedor ${d.de || '-'} → ${d.para || '-'}`;
    case 'integracao_erp': return `Código ${d.codigo_de || '-'} → ${d.codigo_para || '-'}${d.erro ? ` • Erro: ${d.erro}` : ''}`;
    case 'status': return `Aprovação ${arrow(d.aprovacao_de, d.aprovacao_para)} • Ativo ${arrow(d.ativo_de, d.ativo_para)}`;
    case 'desconto': return d.sem_desconto ? 'Marcado sem desconto' : 'Desconto liberado';
    default: return '';
  }
}

export default function AuditLogTab({ storeId }: { storeId: string }) {
  const [entity, setEntity] = useState<Entity>('order');
  const [term, setTerm] = useState('');
  const [search, setSearch] = useState('');

  const { data = [], isLoading } = useQuery({
    queryKey: ['audit-log', storeId, entity, search],
    queryFn: async () => {
      let q = supabase.from('audit_log').select('*').eq('store_id', storeId).eq('entity', entity)
        .order('created_at', { ascending: false }).limit(300);
      const s = search.trim().replace(/[,()%]/g, ' ');
      if (s) {
        const n = s.replace(/^#/, '');
        q = q.or([`ref_label.ilike.%${n}%`, `customer_name.ilike.%${s}%`, `customer_code.ilike.%${s}%`,
          `seller_name.ilike.%${s}%`, `actor_name.ilike.%${s}%`].join(','));
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><History className="h-5 w-5" /><h2 className="text-lg font-semibold">Log de alterações</h2></div>
      <div className="flex flex-wrap gap-2">
        <Button variant={entity === 'order' ? 'default' : 'outline'} size="sm" onClick={() => setEntity('order')}>Pedidos</Button>
        <Button variant={entity === 'customer' ? 'default' : 'outline'} size="sm" onClick={() => setEntity('customer')}>Clientes</Button>
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setSearch(term); }}>
        <Input value={term} onChange={(e) => setTerm(e.target.value)}
          placeholder={entity === 'order' ? 'Nº do pedido, cliente, código ou vendedor/usuário' : 'Cliente, código ou usuário'} />
        <Button type="submit" size="sm" className="gap-1"><Search className="h-4 w-4" /> Buscar</Button>
      </form>
      {isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> :
        data.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum registro encontrado. O log registra as alterações a partir de agora.</p> : (
        <div className="divide-y rounded-md border">
          {data.map((r: any) => (
            <div key={r.id} className="p-3 text-sm space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{r.ref_label}</span>
                <Badge variant={r.action === 'exclusao' || r.action === 'cancelamento' ? 'destructive' : 'secondary'}>{ACTIONS[r.action] ?? r.action}</Badge>
                <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString('pt-BR')}</span>
              </div>
              <div>{r.customer_name}{r.customer_code ? ` (${r.customer_code})` : ''}{r.seller_name ? ` • Vendedor: ${r.seller_name}` : ''}</div>
              <div className="text-muted-foreground">{describe(entity, r.action, r.details || {})}</div>
              <div className="text-xs">Usuário: <span className="font-medium">{r.actor_name}</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
