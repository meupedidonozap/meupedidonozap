import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  useTables, useCreateTable, useUpdateTable, useDeleteTable,
  useOpenSessions, useOpenTable,
} from '@/hooks/useTables';
import type { RestaurantTable } from '@/types';
import TableSessionDialog from './TableSessionDialog';

export default function TablesTab({ storeId }: { storeId: string }) {
  const { data: tables = [], isLoading } = useTables(storeId);
  const { data: sessions = [] } = useOpenSessions(storeId);
  const createTable = useCreateTable();
  const updateTable = useUpdateTable();
  const deleteTable = useDeleteTable();
  const openTable = useOpenTable();

  const [editTable, setEditTable] = useState<RestaurantTable | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ number: '', label: '', seats: '6' });
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);

  const sessionByTable = useMemo(() => {
    const m: Record<string, string> = {};
    sessions.forEach(s => { m[s.tableId] = s.id; });
    return m;
  }, [sessions]);

  const submit = async () => {
    const number = parseInt(form.number, 10);
    if (!number) { toast.error('Informe o número'); return; }
    try {
      if (editTable) {
        await updateTable.mutateAsync({ id: editTable.id, number, label: form.label, seats: parseInt(form.seats) || 6 });
        toast.success('Mesa atualizada');
      } else {
        await createTable.mutateAsync({ storeId, number, label: form.label, seats: parseInt(form.seats) || 6 });
        toast.success('Mesa criada');
      }
      setShowNew(false); setEditTable(null); setForm({ number: '', label: '', seats: '6' });
    } catch (e: any) { toast.error(e.message); }
  };

  const handleOpenTable = async (tableId: string) => {
    const existing = sessionByTable[tableId];
    if (existing) { setOpenSessionId(existing); return; }
    try {
      const s = await openTable.mutateAsync({ storeId, tableId });
      setOpenSessionId(s.id);
    } catch (e: any) { toast.error(e.message); }
  };

  if (isLoading) return <Loader2 className="mx-auto mt-8 h-8 w-8 animate-spin" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Mesas do Salão</h2>
        <Button onClick={() => { setEditTable(null); setForm({ number: '', label: '', seats: '6' }); setShowNew(true); }}>
          <Plus className="mr-1 h-4 w-4" /> Nova Mesa
        </Button>
      </div>

      {tables.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma mesa cadastrada.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {tables.map(t => {
            const isOpen = !!sessionByTable[t.id];
            return (
              <Card key={t.id} className={isOpen ? 'border-2 border-green-500' : ''}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">{t.number}</span>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => { setEditTable(t); setForm({ number: String(t.number), label: t.label || '', seats: String(t.seats) }); setShowNew(true); }}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                        onClick={async () => { if (confirm(`Excluir mesa ${t.number}?`)) { await deleteTable.mutateAsync(t.id); toast.success('Excluída'); } }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {t.label && <div className="text-xs text-muted-foreground truncate">{t.label}</div>}
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" /> {t.seats}
                  </div>
                  <Button size="sm" className="mt-2 w-full" variant={isOpen ? 'default' : 'outline'}
                    onClick={() => handleOpenTable(t.id)}>
                    {isOpen ? <Badge className="bg-green-600">Aberta</Badge> : 'Abrir'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editTable ? 'Editar Mesa' : 'Nova Mesa'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Número *</Label><Input type="number" value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} /></div>
            <div><Label>Etiqueta</Label><Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Ex: Varanda" /></div>
            <div><Label>Lugares</Label><Input type="number" value={form.seats} onChange={e => setForm({ ...form, seats: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={submit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {openSessionId && (
        <TableSessionDialog
          sessionId={openSessionId}
          storeId={storeId}
          onClose={() => setOpenSessionId(null)}
          tableNumber={tables.find(t => sessionByTable[t.id] === openSessionId)?.number}
        />
      )}
    </div>
  );
}