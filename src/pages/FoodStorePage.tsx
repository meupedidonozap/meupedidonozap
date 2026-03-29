import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, Link } from 'react-router-dom';
import {
  Home, Search, ShoppingCart, FileText, Plus, Minus, X,
  ChevronDown, ChevronUp, MapPin, Share2, Loader2, User, LogIn, LogOut, ShoppingBag,
} from 'lucide-react';
import { useStoreBySlug } from '@/hooks/useStores';
import { useAuth } from '@/hooks/useAuth';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import CustomerAuthDialog from '@/components/CustomerAuthDialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCategories } from '@/hooks/useCategories';
import { useFoodItems } from '@/hooks/useFoodItems';
import type { FoodItem } from '@/types';
import { useCart } from '@/contexts/CartContext';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';

export default function FoodStorePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: store, isLoading: storeLoading } = useStoreBySlug(slug || '');
  const { data: categories = [] } = useCategories(store?.id);
  const { data: allFoodItems = [] } = useFoodItems(store?.id);
  const { cart, setStoreId, addItem, removeItem, updateQuantity, clearCart } = useCart();
  const { user, signOut } = useAuth();
  const { data: customerProfile } = useCustomerProfile(user?.id, store?.id);

  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  useEffect(() => {
    if (store) {
      setStoreId(store.id);
      setExpandedCategories(categories.map(c => c.id));
    }
  }, [store, setStoreId, categories.length]);

  const filteredItems = useMemo(() => {
    if (!searchTerm) return allFoodItems;
    return allFoodItems.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allFoodItems, searchTerm]);

  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, FoodItem[]> = {};
    categories.forEach(cat => {
      grouped[cat.id] = filteredItems.filter(item => item.categoryId === cat.id);
    });
    return grouped;
  }, [categories, filteredItems]);

  const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId) ? prev.filter(id => id !== categoryId) : [...prev, categoryId]
    );
  };

  const handleAddItem = (item: FoodItem) => {
    addItem({ productId: item.id, name: item.name, code: item.id, price: item.price, quantity: 1, image: item.image });
    toast.success('Item adicionado!');
  };

  const getItemQuantity = (itemId: string) => cart.items.find(i => i.productId === itemId)?.quantity || 0;

  if (storeLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!store) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Loja não encontrada</h1>
          <Button asChild className="mt-4"><Link to="/">Voltar</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 border-b bg-card">
        <div className="container flex h-14 items-center justify-between">
          <h1 className="text-lg font-bold">{store.name}</h1>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setIsSearchOpen(!isSearchOpen)}>
              <Search className="h-5 w-5" />
            </Button>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1">
                    <User className="h-5 w-5" />
                    <span className="text-sm max-w-[100px] truncate">
                      {customerProfile?.name?.split(' ')[0] || 'Perfil'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-xs text-muted-foreground" disabled>{user.email}</DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/${store.slug}/pedidos`} className="gap-2"><ShoppingBag className="h-4 w-4" /> Meus Pedidos</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()} className="gap-2 text-destructive"><LogOut className="h-4 w-4" /> Sair</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => setAuthDialogOpen(true)}>
                <LogIn className="h-4 w-4" />
                <span className="text-sm">Faça Login</span>
              </Button>
            )}
            <Button variant="ghost" size="icon"><Share2 className="h-5 w-5" /></Button>
          </div>
        </div>
        {isSearchOpen && (
          <div className="container pb-3 animate-slide-up">
            <Input placeholder="Buscar item..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} autoFocus />
          </div>
        )}
      </header>

      <main className="container py-4">
        {categories.map(category => {
          const categoryItems = itemsByCategory[category.id] || [];
          if (categoryItems.length === 0) return null;
          return (
            <Collapsible key={category.id} open={expandedCategories.includes(category.id)} onOpenChange={() => toggleCategory(category.id)} className="mb-6">
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-muted/50 px-4 py-3 font-semibold hover:bg-muted">
                <span className="text-lg">{category.name}</span>
                {expandedCategories.includes(category.id) ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {categoryItems.map(item => {
                    const quantity = getItemQuantity(item.id);
                    return (
                      <Card key={item.id} className="overflow-hidden transition-shadow hover:shadow-md">
                        <CardContent className="flex gap-4 p-4">
                          <div className="flex-1">
                            <h3 className="font-semibold">{item.name}</h3>
                            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                            <p className="mt-2 font-bold text-accent">{formatCurrency(item.price)}</p>
                          </div>
                          <div className="flex flex-col items-end justify-between">
                            {item.image && <img src={item.image} alt={item.name} className="h-20 w-20 rounded-lg object-cover" />}
                            <div className="mt-2">
                              {quantity > 0 ? (
                                <div className="flex items-center gap-2">
                                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQuantity(item.id, quantity - 1)}>
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                  <span className="w-6 text-center font-medium">{quantity}</span>
                                  <Button size="icon" className="h-8 w-8 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => updateQuantity(item.id, quantity + 1)}>
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => handleAddItem(item)}>
                                  <Plus className="mr-1 h-4 w-4" /> Adicionar
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
        {filteredItems.length === 0 && (
          <div className="py-16 text-center">
            <Search className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum item encontrado</h3>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card">
        <div className="container flex h-16 items-center justify-around">
          <Link to={`/${store.slug}`} className="flex flex-col items-center gap-1 text-accent">
            <Home className="h-5 w-5" /><span className="text-xs">Início</span>
          </Link>
          <Link to={`/${store.slug}/admin`} className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground">
            <FileText className="h-5 w-5" /><span className="text-xs">Pedidos</span>
          </Link>
          <Link to={`/${store.slug}/checkout`} className="relative flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground">
            <ShoppingCart className="h-5 w-5" />
            {totalItems > 0 && <Badge className="absolute -right-2 -top-1 h-5 w-5 rounded-full bg-accent p-0 text-xs">{totalItems}</Badge>}
            <span className="text-xs">Carrinho</span>
          </Link>
        </div>
      </nav>

      {totalItems > 0 && (
        <div className="fixed bottom-20 left-0 right-0 z-40 p-4">
          <Button asChild className="w-full gap-2 bg-accent text-accent-foreground shadow-lg hover:bg-accent/90">
            <Link to={`/${store.slug}/checkout`}>
              <ShoppingCart className="h-5 w-5" /> Ver Carrinho ({totalItems} itens) • {formatCurrency(cart.total)}
            </Link>
          </Button>
        </div>
      )}
      <CustomerAuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        storeId={store.id}
      />
    </div>
  );
}
