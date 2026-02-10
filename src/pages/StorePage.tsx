import { useParams } from 'react-router-dom';
import { useStoreBySlug } from '@/hooks/useStores';
import ProductStorePage from './ProductStorePage';
import FoodStorePage from './FoodStorePage';
import { Loader2 } from 'lucide-react';

export default function StorePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: store, isLoading } = useStoreBySlug(slug || '');

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (store?.type === 'COMIDA') {
    return <FoodStorePage />;
  }

  return <ProductStorePage />;
}
