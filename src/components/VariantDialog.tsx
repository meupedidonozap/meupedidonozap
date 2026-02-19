import { useState, useEffect, useCallback } from 'react';
import { ShoppingCart } from 'lucide-react';
import type { Product } from '@/types';
import { formatCurrency } from '@/lib/formatters';
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
                        <img src={img.imageUrl} alt={img.label || product.name} className="h-full w-full object-cover" />
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
                <div className="mt-2 flex justify-center gap-1.5">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      className={`h-2 w-2 rounded-full transition-colors ${i === currentSlide ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                      onClick={() => carouselApi?.scrollTo(i)}
                    />
                  ))}
                </div>
              )}
              {images[currentSlide]?.label && (
                <p className="mt-1 text-center text-sm text-muted-foreground">{images[currentSlide].label}</p>
              )}
            </div>
          ) : product.image ? (
            <div className="flex justify-center">
              <img src={product.image} alt={product.name} className="h-48 w-48 rounded-lg object-cover" />
            </div>
          ) : null}

          <div>
            <h3 className="font-semibold">{product.name}</h3>
            <p className="text-sm text-muted-foreground">{product.description}</p>
            <p className="mt-2 text-lg font-bold">{formatCurrency(product.basePrice)}</p>
          </div>

          {uniqueColors.length > 0 && (
            <div>
              <label className="mb-2 block text-sm font-medium">Cor</label>
              <div className="flex flex-wrap gap-2">
                {uniqueColors.map(color => (
                  <Button key={color} variant={selectedVariant?.color === color ? 'default' : 'outline'} size="sm"
                    onClick={() => handleColorSelect(color!)}>{color}</Button>
                ))}
              </div>
            </div>
          )}

          {availableSizes.length > 0 && (
            <div>
              <label className="mb-2 block text-sm font-medium">Tamanho</label>
              <div className="flex flex-wrap gap-2">
                {availableSizes.map(size => (
                  <Button key={size} variant={selectedVariant?.size === size ? 'default' : 'outline'} size="sm"
                    onClick={() => setSelectedVariant(prev => ({ ...prev, size }))}>{size}</Button>
                ))}
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
