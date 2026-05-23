import { useParams, Link } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useStoreBySlug } from '@/hooks/useStores';
import { useStoreAdmin } from '@/hooks/useStoreAdmin';
import StoreAdminLogin from '@/components/StoreAdminLogin';
import TablesTab from '@/components/TablesTab';

export default function WaiterPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const { data: store, isLoading: storeLoading } = useStoreBySlug(slug || '');
  const { isAdmin, permissions, isLoading: accessLoading } = useStoreAdmin(store?.id);

  if (authLoading || storeLoading || (user && accessLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loja não encontrada</p>
      </div>
    );
  }

  if (!user) {
    return <StoreAdminLogin storeName={`${store.name} — Garçom`} />;
  }

  const canAccess = isAdmin || permissions?.can_manage_orders;
  if (!canAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center space-y-2">
          <p className="font-semibold">Sem permissão</p>
          <p className="text-sm text-muted-foreground">Este usuário não tem permissão de Garçom.</p>
          <Button asChild variant="outline"><Link to={`/${slug}`}>Voltar</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="container flex items-center justify-between py-3">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" asChild>
              <Link to={`/${slug}`}><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
              <h1 className="text-lg font-bold leading-tight">{store.name}</h1>
              <p className="text-xs text-muted-foreground">Modo Garçom</p>
            </div>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link to={`/${slug}/admin`}>Pedidos</Link>
          </Button>
        </div>
      </header>
      <main className="container py-4">
        <TablesTab storeId={store.id} />
      </main>
    </div>
  );
}