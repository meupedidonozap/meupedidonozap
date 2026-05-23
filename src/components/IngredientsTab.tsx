import { useState } from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useIngredients, useCreateIngredient, useUpdateIngredient, useDeleteIngredient } from '@/hooks/useIngredients';
import { useCategories } from '@/hooks/useCategories';
import { formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';
import type { Ingredient } from '@/types';

interface Props { storeId: string; }

export default function IngredientsTab({ storeId }: Props) {
  const { data: ingredients = [] } = useIngredients(storeId);
  const { data: categories = [] } = useCategories(storeId);
  const create = useCreateIngredient();
  const update = useUpdateIngredient();
  const del = useDeleteIngredient();

  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [extraPrice, setExtraPrice] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);

  const openNew = () => {
    setEditing(null);
    setName(''); setExtraPrice('0'); setIsActive(true); setCategoryIds([]);
    setOpen(true);
  };
  const openEdit = (ing: Ingredient) => {
    setEditing(ing);
    setName(ing.name);
    setExtraPrice(String(ing.extraPrice));
    setIsActive(ing.isActive);
    setCategoryIds(ing.categoryIds);
    setOpen(true);
  };

  const save = async () => {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return; }
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, name, extraPrice: Number(extraPrice) || 0, isActive, categoryIds });
        toast.success('Ingrediente atualizado');
      } else {
        await create.mutateAsync({ storeId, name, extraPrice: Number(extraPrice) || 0, isActive, categoryIds });
        toast.success('Ingrediente criado');
      }
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    }
  };

  const remove = async (ing: Ingredient) => {
    if (!confirm(`Remover "${ing.name}"?`)) return;
    try { await del.mutateAsync(ing.id); toast.success('Removido'); }
    catch (e: any) { toast.error(e.message); }
  };

  const toggleCat = (id: string) => {
    setCategoryIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Ingredientes</h2>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Novo</Button>
      </div>

      <Card className="divide-y">
        {ingredients.length === 0 && (
          <div className="p-6 text-center text-muted-foreground">Nenhum ingrediente cadastrado.</div>
        )}
        {ingredients.map(ing => (
          <div key={ing.id} className="flex items-center justify-between p-3 gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-medium flex items-center gap-2">
                {ing.name}
                {!ing.isActive && <span className="text-xs rounded bg-muted px-2 py-0.5">inativo</span>}
              </div>
              <div className="text-sm text-muted-foreground truncate">
                {ing.extraPrice > 0 && <>Extra: {formatCurrency(ing.extraPrice)} • </>}
                {ing.categoryIds.length} categoria(s)
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => openEdit(ing)}><Edit2 className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => remove(ing)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Novo'} Ingrediente</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Preço extra (R$)</Label>
              <Input type="number" step="0.01" value={extraPrice} onChange={e => setExtraPrice(e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded border p-3">
              <Label>Ativo</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <div className="space-y-2">
              <Label>Categorias permitidas</Label>
              <div className="border rounded p-2 max-h-48 overflow-y-auto space-y-1">
                {categories.length === 0 && <p className="text-sm text-muted-foreground">Cadastre categorias primeiro.</p>}
                {categories.map(c => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer py-1">
                    <Checkbox checked={categoryIds.includes(c.id)} onCheckedChange={() => toggleCat(c.id)} />
                    <span>{c.name}</span>
                  </label>
                ))}
              </div>
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