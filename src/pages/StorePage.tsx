import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useStoreBySlug } from '@/hooks/useStores';
import { useTrackVisit } from '@/hooks/useStoreVisits';
import ProductStorePage from './ProductStorePage';
import FoodStorePage from './FoodStorePage';
import { Loader2 } from 'lucide-react';

export default function StorePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: store, isLoading } = useStoreBySlug(slug || '');

  // Track visit once per session
  useTrackVisit(store?.id);

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

  // SERVICOS and LOJA/ACESSORIOS all use ProductStorePage
  return <ProductStorePage />;
}
