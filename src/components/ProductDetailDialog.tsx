import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { Product } from '@/types';

interface Props {
  product: Product | null;
  onOpenChange: (open: boolean) => void;
  priceLabel?: React.ReactNode;
  canBuy: boolean;
  onAdd: (p: Product) => void;
}

export default function ProductDetailDialog({ product, onOpenChange, priceLabel, canBuy, onAdd }: Props) {
  const [idx, setIdx] = useState(0);
  const [touchX, setTouchX] = useState<number | null>(null);
  useEffect(() => setIdx(0), [product?.id]);
  if (!product) return null;
  const photos = Array.from(new Set([product.image, ...(product.images || []).map((i: any) => i.imageUrl)].filter(Boolean))) as string[];
  const go = (d: number) => photos.length && setIdx((i) => (i + d + photos.length) % photos.length);
  const variants = (product as any).variants as any[] | undefined;

  return (
    <Dialog open={!!product} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle className="pr-6">{product.name}</DialogTitle></DialogHeader>
        <div
          className="relative aspect-square w-full overflow-hidden rounded-lg bg-white"
          onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
          onTouchEnd={(e) => { if (touchX === null) return; const dx = e.changedTouches[0].clientX - touchX; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); setTouchX(null); }}
        >
          {photos.length ? <img src={photos[idx]} alt={product.name} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center bg-muted text-muted-foreground">Sem foto</div>}
          {photos.length > 1 && (
            <>
              <Button size="icon" variant="secondary" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full" onClick={() => go(-1)} aria-label="Foto anterior"><ChevronLeft className="h-5 w-5" /></Button>
              <Button size="icon" variant="secondary" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full" onClick={() => go(1)} aria-label="Próxima foto"><ChevronRight className="h-5 w-5" /></Button>
            </>
          )}
        </div>
        {photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photos.map((p, i) => (
              <button key={p} onClick={() => setIdx(i)} className={`h-14 w-14 shrink-0 overflow-hidden rounded border-2 bg-white ${i === idx ? 'border-primary' : 'border-transparent'}`}>
                <img src={p} alt="" className="h-full w-full object-contain" />
              </button>
            ))}
          </div>
        )}
        <div className="space-y-2">
          <Badge variant="outline" className="font-mono text-xs">{product.code}</Badge>
          {priceLabel}
          {product.description && <p className="whitespace-pre-line text-sm text-muted-foreground">{product.description}</p>}
          {variants && variants.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {variants.map((v: any) => <Badge key={v.id} variant="secondary">{[v.color, v.size].filter(Boolean).join(' / ') || v.sku}</Badge>)}
            </div>
          )}
        </div>
        {canBuy && (
          <Button className="w-full gap-2" onClick={() => { onAdd(product); onOpenChange(false); }}><Plus className="h-4 w-4" /> Adicionar</Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
