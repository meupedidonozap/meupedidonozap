import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, ToggleLeft, ToggleRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { useUpdateStore } from '@/hooks/useStores';
import {
  DEFAULT_DICOLORE_FORMAS,
  DEFAULT_DICOLORE_CONDICOES,
  type PaymentForma,
  type PaymentCondicao,
} from '@/lib/dicolorePayments';

interface Props {
  store: any;
}

export default function DicolorePaymentCodesTab({ store }: Props) {
  const updateStore = useUpdateStore();
  const [formas, setFormas] = useState<PaymentForma[]>([]);
  const [condicoes, setCondicoes] = useState<PaymentCondicao[]>([]);
  const [init, setInit] = useState(false);

  useEffect(() => {
    if (!store || init) return;
    const f = store.settings?.formasPagamento;
    const c = store.settings?.condicoesPagamento;
    setFormas(Array.isArray(f) && f.length ? f : DEFAULT_DICOLORE_FORMAS);
    setCondicoes(Array.isArray(c) && c.length ? c : DEFAULT_DICOLORE_CONDICOES);
    setInit(true);
  }, [store, init]);

  const save = async () => {
    try {
      await updateStore.mutateAsync({
        id: store.id,
        settings: {
          ...store.settings,
          formasPagamento: formas,
          condicoesPagamento: condicoes,
        },
      });
      toast.success('Formas e condições de pagamento salvas!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    }
  };

  const renderList = <T extends PaymentForma | PaymentCondicao>(
    items: T[],
    setItems: (v: T[]) => void,
    defaults: T[],
    title: string,
    subtitle: string,
  ) => (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{title}</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setItems([...defaults]); toast.message('Lista restaurada para o padrão'); }}
          >
            <RotateCcw className="h-4 w-4 mr-1" /> Padrão
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Código (ERP)</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-24">Filial</TableHead>
              <TableHead className="w-20">Ativo</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row, idx) => (
              <TableRow key={idx}>
                <TableCell>
                  <Input
                    className="h-8"
                    value={row.codigo}
                    onChange={e => setItems(items.map((r, i) => i === idx ? { ...r, codigo: e.target.value.trim() } : r) as T[])}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    className="h-8"
                    value={row.descricao}
                    onChange={e => setItems(items.map((r, i) => i === idx ? { ...r, descricao: e.target.value } : r) as T[])}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    className="h-8"
                    value={row.filial}
                    onChange={e => setItems(items.map((r, i) => i === idx ? { ...r, filial: e.target.value } : r) as T[])}
                  />
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => setItems(items.map((r, i) => i === idx ? { ...r, ativo: !r.ativo } : r) as T[])}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {row.ativo ? <ToggleRight className="h-5 w-5 text-accent" /> : <ToggleLeft className="h-5 w-5" />}
                  </button>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setItems(items.filter((_, i) => i !== idx) as T[])}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setItems([...items, { codigo: '', descricao: '', filial: '*', ativo: true } as T])}
        >
          <Plus className="h-4 w-4 mr-1" /> Adicionar linha
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div>
      {renderList<PaymentForma>(
        formas, setFormas as any, DEFAULT_DICOLORE_FORMAS,
        'Formas de Pagamento (ERP)',
        'Códigos do ERP usados no XML de integração e exibidos ao cliente no checkout.',
      )}
      {renderList<PaymentCondicao>(
        condicoes, setCondicoes as any, DEFAULT_DICOLORE_CONDICOES,
        'Condições de Pagamento (ERP)',
        'Códigos do ERP enviados no XML como condicaoPagamento.',
      )}
      <div className="mt-4">
        <Button onClick={save} disabled={updateStore.isPending}>
          {updateStore.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Salvar Formas e Condições
        </Button>
      </div>
    </div>
  );
}