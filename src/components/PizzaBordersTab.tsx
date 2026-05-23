import { useState } from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { usePizzaBorders, useCreatePizzaBorder, useUpdatePizzaBorder, useDeletePizzaBorder } from '@/hooks/usePizzaBorders';
import { formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';
import type { PizzaBorder } from '@/types';

interface Props { storeId: string; }

export default function PizzaBordersTab({ storeId }: Props) {
  const { data: borders = [] } = usePizzaBorders(storeId);
  const create = useCreatePizzaBorder();
  const update = useUpdatePizzaBorder();
  const del = useDeletePizzaBorder();

  const [editing, setEditing] = useState<PizzaBorder | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('0');
  const [isActive, setIsActive] = useState(true);

  const openNew = () => { setEditing(null); setName(''); setPrice('0'); setIsActive(true); setOpen(true); };
  const openEdit = (b: PizzaBorder) => { setEditing(b); setName(b.name); setPrice(String(b.price)); setIsActive(b.isActive); setOpen(true); };

  const save = async () => {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return; }
    try {
      if (editing) await update.mutateAsync({ id: editing.id, name, price: Number(price) || 0, isActive });
      else await create.mutateAsync({ storeId, name, price: Number(price) || 0, isActive });
      toast.success('Salvo');
      setOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const remove = async (b: PizzaBorder) => {
    if (!confirm(`Remover "${b.name}"?`)) return;
    try { await del.mutateAsync(b.id); toast.success('Removido'); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Bordas Recheadas</h2>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Nova</Button>
      </div>
      <Card className="divide-y">
        {borders.length === 0 && <div className="p-6 text-center text-muted-foreground">Nenhuma borda cadastrada.</div>}
        {borders.map(b => (
          <div key={b.id} className="flex items-center justify-between p-3 gap-2">
            <div className="flex-1">
              <div className="font-medium flex items-center gap-2">
                {b.name}
                {!b.isActive && <span className="text-xs rounded bg-muted px-2 py-0.5">inativa</span>}
              </div>
              <div className="text-sm text-muted-foreground">{formatCurrency(b.price)}</div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => openEdit(b)}><Edit2 className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => remove(b)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Nova'} Borda</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Catupiry" />
            </div>
            <div className="grid gap-2">
              <Label>Preço (R$)</Label>
              <Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded border p-3">
              <Label>Ativa</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}