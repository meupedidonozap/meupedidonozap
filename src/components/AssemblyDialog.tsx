import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';
import type { Product, Ingredient, PizzaBorder, ProductAssembly, CartItem } from '@/types';

interface AssemblyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  assembly: ProductAssembly;
  ingredients: Ingredient[]; // already filtered by product category
  borders: PizzaBorder[];
  onConfirm: (item: CartItem) => void;
}

export default function AssemblyDialog({
  open, onOpenChange, product, assembly, ingredients, borders, onConfirm,
}: AssemblyDialogProps) {
  const hasVariants = product.hasVariants && (product.variants?.length || 0) > 0;
  const [variantId, setVariantId] = useState<string | undefined>(undefined);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [borderId, setBorderId] = useState<string | undefined>(undefined);
  const [observation, setObservation] = useState('');

  useEffect(() => {
    if (!open) return;
    setVariantId(hasVariants ? product.variants![0].id : undefined);
    if (assembly.mode === 'remove') {
      setSelectedIds([...assembly.defaultIngredientIds]);
    } else {
      setSelectedIds([]);
    }
    setRemovedIds([]);
    setBorderId(undefined);
    setObservation('');
  }, [open, product.id]);

  const variant = useMemo(
    () => product.variants?.find(v => v.id === variantId),
    [product.variants, variantId]
  );

  const basePrice = variant?.price ?? product.basePrice;

  const limit = useMemo(() => {
    if (assembly.mode !== 'choose') return Infinity;
    if (variantId && assembly.limitsByVariant[variantId] != null) return assembly.limitsByVariant[variantId];
    return assembly.limitsByVariant['default'] ?? 99;
  }, [assembly, variantId]);

  const activeIngredients = useMemo(
    () => ingredients.filter(i => i.isActive),
    [ingredients]
  );

  const defaultIngredientsForRemove = useMemo(() => {
    if (assembly.mode !== 'remove') return [];
    return activeIngredients.filter(i => assembly.defaultIngredientIds.includes(i.id));
  }, [activeIngredients, assembly]);

  const toggleChoose = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= limit) {
        toast.warning(`Limite de ${limit} ingredientes atingido`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const toggleRemove = (id: string) => {
    // In "remove" mode the user UNCHECKS pre-checked items -> they go to removedIds
    setSelectedIds(prev => prev.filter(x => x !== id));
    setRemovedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const totalExtras = useMemo(() => {
    let sum = 0;
    if (assembly.mode === 'choose') {
      for (const id of selectedIds) {
        const ing = activeIngredients.find(i => i.id === id);
        if (ing) sum += ing.extraPrice;
      }
    }
    const border = borders.find(b => b.id === borderId);
    if (border) sum += border.price;
    return sum;
  }, [selectedIds, borderId, activeIngredients, borders, assembly.mode]);

  const totalPrice = basePrice + totalExtras;

  const handleConfirm = () => {
    if (assembly.mode === 'choose' && selectedIds.length === 0) {
      toast.error('Selecione ao menos um ingrediente');
      return;
    }

    const selectedIngredients = selectedIds
      .map(id => activeIngredients.find(i => i.id === id))
      .filter(Boolean)
      .map(i => ({ id: i!.id, name: i!.name, extraPrice: i!.extraPrice }));

    const removed = removedIds
      .map(id => activeIngredients.find(i => i.id === id))
      .filter(Boolean)
      .map(i => ({ id: i!.id, name: i!.name }));

    const border = borders.find(b => b.id === borderId);

    const item: CartItem = {
      productId: product.id,
      variantId,
      groupId: product.groupId,
      name: product.name,
      code: product.code || product.id,
      size: variant?.size,
      color: variant?.color,
      price: totalPrice,
      quantity: 1,
      image: product.image,
      ingredients: selectedIngredients.length ? selectedIngredients : undefined,
      removedIngredients: removed.length ? removed : undefined,
      border: border ? { id: border.id, name: border.name, price: border.price } : undefined,
      observation: observation.trim() || undefined,
    };
    onConfirm(item);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {hasVariants && (
            <div className="space-y-2">
              <Label>Tamanho</Label>
              <div className="flex flex-wrap gap-2">
                {product.variants!.map(v => (
                  <Button
                    key={v.id}
                    type="button"
                    size="sm"
                    variant={variantId === v.id ? 'default' : 'outline'}
                    onClick={() => { setVariantId(v.id); setSelectedIds([]); }}
                  >
                    {v.size || v.color || 'Padrão'} • {formatCurrency(v.price)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {assembly.mode === 'choose' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Ingredientes</Label>
                <Badge variant="secondary">
                  {selectedIds.length}/{limit === Infinity ? '∞' : limit}
                </Badge>
              </div>
              {activeIngredients.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum ingrediente disponível para esta categoria.
                </p>
              )}
              <div className="grid gap-2 max-h-60 overflow-y-auto rounded border p-2">
                {activeIngredients.map(ing => {
                  const checked = selectedIds.includes(ing.id);
                  return (
                    <label key={ing.id} className="flex items-center justify-between gap-2 cursor-pointer rounded px-2 py-1 hover:bg-muted">
                      <div className="flex items-center gap-2">
                        <Checkbox checked={checked} onCheckedChange={() => toggleChoose(ing.id)} />
                        <span>{ing.name}</span>
                      </div>
                      {ing.extraPrice > 0 && (
                        <span className="text-sm text-muted-foreground">+{formatCurrency(ing.extraPrice)}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {assembly.mode === 'remove' && defaultIngredientsForRemove.length > 0 && (
            <div className="space-y-2">
              <Label>Ingredientes (desmarque para remover)</Label>
              <div className="grid gap-2 max-h-60 overflow-y-auto rounded border p-2">
                {defaultIngredientsForRemove.map(ing => {
                  const checked = selectedIds.includes(ing.id);
                  return (
                    <label key={ing.id} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-muted">
                      <Checkbox checked={checked} onCheckedChange={() => toggleRemove(ing.id)} />
                      <span>{ing.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {assembly.allowBorder && borders.filter(b => b.isActive).length > 0 && (
            <div className="space-y-2">
              <Label>Borda recheada</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={!borderId ? 'default' : 'outline'}
                  onClick={() => setBorderId(undefined)}
                >
                  Sem borda
                </Button>
                {borders.filter(b => b.isActive).map(b => (
                  <Button
                    key={b.id}
                    type="button"
                    size="sm"
                    variant={borderId === b.id ? 'default' : 'outline'}
                    onClick={() => setBorderId(b.id)}
                  >
                    {b.name} • +{formatCurrency(b.price)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {assembly.allowObservation && (
            <div className="space-y-2">
              <Label htmlFor="obs">Observação</Label>
              <Textarea
                id="obs"
                value={observation}
                onChange={e => setObservation(e.target.value)}
                placeholder="Ex.: sem cebola, ponto da carne, etc."
                rows={2}
              />
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between gap-2">
          <div className="text-lg font-bold">{formatCurrency(totalPrice)}</div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleConfirm}>Adicionar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}