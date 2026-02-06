import { Link } from 'react-router-dom';
import { Store, ShoppingBag, Pizza, ChevronRight } from 'lucide-react';
import { mockStores } from '@/data/mockData';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const storeTypeIcons = {
  LOJA: ShoppingBag,
  ACESSORIOS: Store,
  COMIDA: Pizza,
};

export default function HomePage() {
  const activeStores = mockStores.filter(s => s.isActive);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="gradient-primary text-primary-foreground">
        <div className="container py-16 text-center">
          <h1 className="mb-4 text-4xl font-bold md:text-5xl">MeuPedidoNoZap</h1>
          <p className="mx-auto max-w-2xl text-lg text-primary-foreground/80">
            Faça seu pedido online e receba diretamente no WhatsApp. Simples, rápido e prático.
          </p>
        </div>
      </header>

      {/* Store List */}
      <main className="container py-12">
        <div className="mb-8 text-center">
          <h2 className="mb-2 text-2xl font-bold">Lojas Disponíveis</h2>
          <p className="text-muted-foreground">Escolha uma loja e faça seu pedido</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {activeStores.map(store => {
            const Icon = storeTypeIcons[store.type];
            return (
              <Card
                key={store.id}
                className="group overflow-hidden transition-all hover:shadow-lg"
              >
                <div className="h-32 gradient-primary flex items-center justify-center">
                  <Icon className="h-16 w-16 text-primary-foreground/50" />
                </div>
                <CardContent className="p-6">
                  <div className="mb-3 flex items-start justify-between">
                    <h3 className="text-xl font-bold">{store.name}</h3>
                    <Badge variant="secondary" className="shrink-0">
                      {store.type === 'COMIDA' ? 'Delivery' : 'Loja'}
                    </Badge>
                  </div>
                  <p className="mb-4 text-sm text-muted-foreground line-clamp-2">
                    {store.address}
                  </p>
                  <Button asChild className="w-full group-hover:bg-accent group-hover:text-accent-foreground">
                    <Link to={`/${store.slug}`}>
                      Acessar Loja
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {activeStores.length === 0 && (
          <div className="py-16 text-center">
            <Store className="mx-auto h-16 w-16 text-muted-foreground/30" />
            <h3 className="mt-4 text-xl font-semibold">Nenhuma loja disponível</h3>
            <p className="text-muted-foreground">Volte em breve!</p>
          </div>
        )}

        {/* Admin Link */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            É lojista?{' '}
            <Link to="/admin" className="text-primary hover:underline">
              Acesse o painel administrativo
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
