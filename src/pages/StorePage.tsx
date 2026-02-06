import { useParams } from 'react-router-dom';
import { getStoreBySlug } from '@/data/mockData';
import ProductStorePage from './ProductStorePage';
import FoodStorePage from './FoodStorePage';

export default function StorePage() {
  const { slug } = useParams<{ slug: string }>();
  const store = getStoreBySlug(slug || '');

  if (store?.type === 'COMIDA') {
    return <FoodStorePage />;
  }

  return <ProductStorePage />;
}
