import { useState, useEffect, useCallback } from 'react';
import { ShoppingCart } from 'lucide-react';
import type { Product } from '@/types';
import { formatCurrency } from '@/lib/formatters';
import { getVariantPriceOrNull, type PriceTable } from '@/lib/pricing';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi,
} from '@/components/ui/carousel';

interface VariantDialogProps {
  product: Product | null;
  onClose: () => void;
  uniqueColors: string[];
  uniqueSizes: string[];
  availableSizes: string[];
  selectedVariant: { color?: string; size?: string } | null;
  setSelectedVariant: React.Dispatch<React.SetStateAction<{ color?: string; size?: string } | null>>;
  onAddToCart: (product: Product, variant?: { color?: string; size?: string }) => void;
  priceTable?: PriceTable;
  stockEnabled?: boolean;
}

export default function VariantDialog({
  product,
  onClose,
  uniqueColors,
  uniqueSizes,
  availableSizes,
  selectedVariant,
  setSelectedVariant,
  onAddToCart,
  priceTable,
  stockEnabled = true,
}: VariantDialogProps) {
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);

  const images = product?.images?.length ? product.images : [];
  const hasImages = images.length > 0;

  const onSelect = useCallback(() => {
    if (!carouselApi) return;
    setCurrentSlide(carouselApi.selectedScrollSnap());
  }, [carouselApi]);

  useEffect(() => {
    if (!carouselApi) return;
    carouselApi.on('select', onSelect);
    return () => { carouselApi.off('select', onSelect); };
  }, [carouselApi, onSelect]);

  // When user selects a color, scroll to matching image
  const handleColorSelect = (color: string) => {
    setSelectedVariant(prev => ({ ...prev, color, size: undefined }));
    if (carouselApi && images.length > 0) {
      const idx = images.findIndex(img => img.label?.toLowerCase() === color.toLowerCase());
      if (idx >= 0) carouselApi.scrollTo(idx);
    }
  };

  // When carousel slides, auto-select matching color
  useEffect(() => {
    if (!hasImages || !carouselApi) return;
    const label = images[currentSlide]?.label;
    if (label && uniqueColors.some(c => c?.toLowerCase() === label.toLowerCase())) {
      setSelectedVariant(prev => {
        if (prev?.color?.toLowerCase() === label.toLowerCase()) return prev;
        return { ...prev, color: uniqueColors.find(c => c?.toLowerCase() === label.toLowerCase()), size: undefined };
      });
    }
  }, [currentSlide, hasImages, images, uniqueColors, carouselApi, setSelectedVariant]);

  const variants = product?.variants ?? [];
  const norm = (x?: string) => (x || '').trim().toLowerCase();
  const colorInStock = (color: string) =>
    !stockEnabled || variants.some(v => norm(v.color) === norm(color) && Number(v.stock) > 0);
  const sizeInStock = (size: string) =>
    !stockEnabled || variants.some(v => norm(v.size) === norm(size)
      && (!selectedVariant?.color || norm(v.color) === norm(selectedVariant.color)) && Number(v.stock) > 0);
  const colorImage = (color: string) => images.find(img => norm(img.label) === norm(color))?.imageUrl;
  const activeVariant = variants.find(v =>
    (!selectedVariant?.color || norm(v.color) === norm(selectedVariant.color))
    && (!selectedVariant?.size || norm(v.size) === norm(selectedVariant.size)));
  const priceOf = (v?: typeof variants[number]) => (v ? getVariantPriceOrNull(v, priceTable) ?? v.price : product?.basePrice ?? 0);
  const salePrice = selectedVariant?.color ? priceOf(activeVariant) : (variants.length ? Math.min(...variants.map(v => priceOf(v))) : product?.basePrice ?? 0);
  const fromPrice = (selectedVariant?.color ? activeVariant?.suggestedPrice : undefined) || product?.suggestedPrice
    || (variants.length ? Math.max(0, ...variants.map(v => v.suggestedPrice || 0)) : 0);
  const showPromo = !!fromPrice && fromPrice > salePrice && salePrice > 0;
  const discountPct = showPromo ? Math.round((1 - salePrice / fromPrice) * 100) : 0;

  if (!product) return null;

  return (
    <Dialog open={!!product} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader><DialogTitle>Selecione as opções</DialogTitle></DialogHeader>
        <div className="overflow-y-auto flex-1 space-y-4 pr-1">
          {/* Carousel for multiple images */}
          {hasImages ? (
            <div className="relative">
              <Carousel setApi={setCarouselApi} className="w-full">
                <CarouselContent>
                  {images.map((img, i) => (
                    <CarouselItem key={img.id || i}>
                      <div className="aspect-square overflow-hidden rounded-lg bg-muted">
                        <img src={img.imageUrl} alt={img.label || product.name} loading="lazy" className="h-full w-full bg-white object-contain" />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {images.length > 1 && (
                  <>
                    <CarouselPrevious className="left-2" />
                    <CarouselNext className="right-2" />
                  </>
                )}
              </Carousel>
              {images.length > 1 && (
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Foto ${i + 1}`}
                      className={`h-16 w-16 shrink-0 overflow-hidden rounded border-2 bg-white ${i === currentSlide ? 'border-destructive' : 'border-transparent'}`}
                      onClick={() => carouselApi?.scrollTo(i)}
                    >
                      <img src={img.imageUrl} alt="" className="h-full w-full object-contain" />
                    </button>
                  ))}
                </div>
              )}
              {images[currentSlide]?.label && (
                <p className="mt-1 text-center text-sm text-muted-foreground">{images[currentSlide].label}</p>
              )}
            </div>
          ) : product.image ? (
            <div className="flex justify-center">
              <img src={product.image} alt={product.name} loading="lazy" className="h-48 w-48 rounded-lg object-cover" />
            </div>
          ) : null}

          <div>
            <h3 className="font-semibold">{product.name}</h3>
            <p className="text-sm text-muted-foreground">{product.description}</p>
            <div className="mt-2 flex flex-wrap items-baseline gap-2 rounded-md bg-muted/40 px-3 py-2">
              <span className="text-2xl font-bold text-destructive">{formatCurrency(salePrice)}</span>
              {showPromo && (
                <>
                  <span className="text-sm text-muted-foreground line-through">{formatCurrency(fromPrice)}</span>
                  <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-semibold text-destructive">-{discountPct}%</span>
                </>
              )}
            </div>
          </div>

          {uniqueColors.length > 0 && (
            <div>
              <label className="mb-2 block text-sm font-medium">Cor</label>
              <div className="flex flex-wrap gap-2">
                {uniqueColors.map(color => {
                  const available = colorInStock(color);
                  const selected = selectedVariant?.color === color;
                  const thumb = colorImage(color);
                  return (
                    <button key={color} type="button" disabled={!available} aria-disabled={!available}
                      title={available ? color : `${color} — sem estoque`}
                      onClick={() => available && handleColorSelect(color!)}
                      className={`flex items-center gap-2 rounded border px-2 py-1 text-sm transition-colors ${
                        !available ? 'cursor-not-allowed border-border bg-muted text-muted-foreground opacity-50 grayscale'
                        : selected ? 'border-destructive text-destructive' : 'border-border hover:border-destructive'}`}>
                      {thumb && <img src={thumb} alt="" className="h-6 w-6 rounded-sm bg-white object-contain" />}
                      <span>{color}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {availableSizes.length > 0 && (
            <div>
              <label className="mb-2 block text-sm font-medium">Tamanho</label>
              <div className="flex flex-wrap gap-2">
                {availableSizes.map(size => {
                  const available = sizeInStock(size);
                  return (
                    <Button key={size} variant={selectedVariant?.size === size ? 'default' : 'outline'} size="sm"
                      disabled={!available} className={!available ? 'opacity-50 grayscale' : ''}
                      onClick={() => setSelectedVariant(prev => ({ ...prev, size }))}>{size}</Button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <Button className="w-full mt-2"
          disabled={(uniqueColors.length > 0 && !selectedVariant?.color) || (availableSizes.length > 0 && !selectedVariant?.size)}
          onClick={() => onAddToCart(product, selectedVariant || undefined)}>
          <ShoppingCart className="mr-2 h-4 w-4" /> Adicionar ao Carrinho
        </Button>
      </DialogContent>
    </Dialog>
  );
}
