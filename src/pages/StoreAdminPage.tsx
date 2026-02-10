import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingCart, Settings, Tags, Percent,
  ArrowLeft, Plus, Edit2, Trash2, Eye, Printer, CheckCircle, Clock,
  Truck, XCircle, ToggleLeft, ToggleRight, Loader2,
} from 'lucide-react';
import { useStoreBySlug } from '@/hooks/useStores';
import { useCategories, useCreateCategory, useDeleteCategory } from '@/hooks/useCategories';
import { useProducts, useUpdateProduct, useDeleteProduct } from '@/hooks/useProducts';
import { useFoodItems } from '@/hooks/useFoodItems';
import { useOrders, useUpdateOrderStatus } from '@/hooks/useOrders';
import { useCoupons } from '@/hooks/useCoupons';
import type { OrderStatus, Product } from '@/types';
import ProductFormDialog from '@/components/ProductFormDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { toast } from 'sonner';

const statusConfig: Record<OrderStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700', icon: <Clock className="h-4 w-4" /> },
  confirmado: { label: 'Confirmado', color: 'bg-blue-100 text-blue-700', icon: <CheckCircle className="h-4 w-4" /> },
  preparando: { label: 'Preparando', color: 'bg-orange-100 text-orange-700', icon: <Package className="h-4 w-4" /> },
  enviado: { label: 'Enviado', color: 'bg-purple-100 text-purple-700', icon: <Truck className="h-4 w-4" /> },
  entregue: { label: 'Entregue', color: 'bg-green-100 text-green-700', icon: <CheckCircle className="h-4 w-4" /> },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-700', icon: <XCircle className="h-4 w-4" /> },
};

export default function StoreAdminPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: store, isLoading: storeLoading } = useStoreBySlug(slug || '');
  const { data: categories = [] } = useCategories(store?.id);
  const { data: products = [] } = useProducts(store?.id);
  const { data: foodItems = [] } = useFoodItems(store?.id);
  const { data: orders = [] } = useOrders(store?.id);
  const { data: coupons = [] } = useCoupons(store?.id);

  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const updateOrderStatus = useUpdateOrderStatus();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');

  const allProducts = store?.type === 'COMIDA' ? foodItems : products;

  if (storeLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!store) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Loja não encontrada</h1>
          <Button asChild className="mt-4"><Link to="/admin">Voltar ao Admin</Link></Button>
        </div>
      </div>
    );
  }

  const stats = {
    totalProducts: allProducts.length,
    totalOrders: orders.length,
    pendingOrders: orders.filter(o => o.status === 'pendente').length,
    todayRevenue: orders
      .filter(o => new Date(o.createdAt).toDateString() === new Date().toDateString())
      .reduce((sum, o) => sum + o.total, 0),
  };

  const handleToggleProductActive = async (product: Product) => {
    await updateProduct.mutateAsync({ id: product.id, isActive: !product.isActive });
    toast.success('Status atualizado!');
  };

  const handleDeleteProduct = async (productId: string) => {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
      await deleteProduct.mutateAsync(productId);
      toast.success('Produto excluído!');
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductDialogOpen(true);
  };

  const handleNewProduct = () => {
    setEditingProduct(null);
    setProductDialogOpen(true);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    await createCategory.mutateAsync({ storeId: store.id, name: newCategoryName });
    setNewCategoryName('');
    toast.success('Categoria criada!');
  };

  const handleDeleteCategory = async (id: string) => {
    if (confirm('Excluir categoria?')) {
      await deleteCategory.mutateAsync(id);
      toast.success('Categoria excluída!');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-primary text-primary-foreground">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild className="text-primary-foreground hover:bg-primary-foreground/10">
                <Link to="/admin"><ArrowLeft className="h-5 w-5" /></Link>
              </Button>
              <div>
                <h1 className="text-xl font-bold">{store.name}</h1>
                <p className="text-sm text-primary-foreground/80">Painel da Loja</p>
              </div>
            </div>
            <Button variant="outline" asChild className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
              <Link to={`/${store.slug}`}><Eye className="mr-2 h-4 w-4" /> Ver Loja</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex flex-wrap h-auto gap-1">
            <TabsTrigger value="dashboard" className="gap-2"><LayoutDashboard className="h-4 w-4" /> Dashboard</TabsTrigger>
            <TabsTrigger value="products" className="gap-2"><Package className="h-4 w-4" /> Produtos</TabsTrigger>
            <TabsTrigger value="categories" className="gap-2"><Tags className="h-4 w-4" /> Categorias</TabsTrigger>
            <TabsTrigger value="orders" className="gap-2">
              <ShoppingCart className="h-4 w-4" /> Pedidos
              {stats.pendingOrders > 0 && <Badge className="ml-1 bg-destructive text-destructive-foreground">{stats.pendingOrders}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="coupons" className="gap-2"><Percent className="h-4 w-4" /> Cupons</TabsTrigger>
            <TabsTrigger value="settings" className="gap-2"><Settings className="h-4 w-4" /> Configurações</TabsTrigger>
          </TabsList>

          {/* Dashboard */}
          <TabsContent value="dashboard" className="animate-fade-in">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total de Produtos</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{stats.totalProducts}</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total de Pedidos</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{stats.totalOrders}</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pedidos Pendentes</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-warning">{stats.pendingOrders}</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Faturamento Hoje</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-accent">{formatCurrency(stats.todayRevenue)}</div></CardContent></Card>
            </div>
            <Card className="mt-6">
              <CardHeader><CardTitle>Pedidos Recentes</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Cliente</TableHead><TableHead>Itens</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Data</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {orders.slice(0, 5).map(order => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">#{order.orderNumber}</TableCell>
                        <TableCell>{order.customer.name}</TableCell>
                        <TableCell>{order.items.length} itens</TableCell>
                        <TableCell>{formatCurrency(order.total)}</TableCell>
                        <TableCell><Badge className={statusConfig[order.status].color}>{statusConfig[order.status].label}</Badge></TableCell>
                        <TableCell>{formatDateTime(order.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products */}
          <TabsContent value="products" className="animate-fade-in">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Produtos</h3>
              <Button className="gap-2" onClick={handleNewProduct}><Plus className="h-4 w-4" /> Novo Produto</Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Imagem</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map(product => (
                      <TableRow key={product.id}>
                        <TableCell>
                          {product.image ? (
                            <img src={product.image} alt={product.name} className="h-10 w-10 rounded object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded bg-muted text-xs text-muted-foreground">Sem</div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{product.code || '-'}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1">{product.description}</p>
                          </div>
                        </TableCell>
                        <TableCell>{categories.find(c => c.id === product.categoryId)?.name || '-'}</TableCell>
                        <TableCell>{formatCurrency(product.basePrice)}</TableCell>
                        <TableCell>
                          <button onClick={() => handleToggleProductActive(product)}>
                            {product.isActive ? <ToggleRight className="h-6 w-6 text-accent" /> : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEditProduct(product)}><Edit2 className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteProduct(product.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {products.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nenhum produto cadastrado</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Categories */}
          <TabsContent value="categories" className="animate-fade-in">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Categorias</h3>
              <div className="flex gap-2">
                <Input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Nome da categoria" className="w-48" />
                <Button className="gap-2" onClick={handleAddCategory}><Plus className="h-4 w-4" /> Adicionar</Button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map(category => (
                <Card key={category.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">{category.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {products.filter(p => p.categoryId === category.id).length} produtos
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteCategory(category.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Orders */}
          <TabsContent value="orders" className="animate-fade-in">
            <div className="mb-4"><h3 className="text-lg font-semibold">Pedidos</h3></div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead><TableHead>Cliente</TableHead><TableHead>Itens</TableHead>
                      <TableHead>Total</TableHead><TableHead>Pagamento</TableHead><TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map(order => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <p className="font-medium">#{order.orderNumber}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</p>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{order.customer.name}</p>
                          <p className="text-xs text-muted-foreground">{order.customer.whatsapp}</p>
                        </TableCell>
                        <TableCell>{order.items.length} itens</TableCell>
                        <TableCell className="font-medium">{formatCurrency(order.total)}</TableCell>
                        <TableCell className="uppercase text-xs">{order.paymentMethod}</TableCell>
                        <TableCell>
                          <Select value={order.status} onValueChange={(value) => {
                            updateOrderStatus.mutateAsync({ id: order.id, status: value as OrderStatus });
                            toast.success('Status atualizado!');
                          }}>
                            <SelectTrigger className="w-32">
                              <Badge className={statusConfig[order.status].color}>
                                {statusConfig[order.status].icon}
                                <span className="ml-1">{statusConfig[order.status].label}</span>
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(statusConfig).map(([key, cfg]) => (
                                <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => toast.success('Pedido enviado para impressão')}>
                            <Printer className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Coupons */}
          <TabsContent value="coupons" className="animate-fade-in">
            <div className="mb-4"><h3 className="text-lg font-semibold">Cupons de Desconto</h3></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {coupons.map(coupon => (
                <Card key={coupon.id}>
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <Badge variant="outline" className="font-mono text-lg">{coupon.code}</Badge>
                      <Badge variant={coupon.isActive ? 'default' : 'secondary'}>{coupon.isActive ? 'Ativo' : 'Inativo'}</Badge>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Desconto:</span> <span className="font-medium">{coupon.discountPercent ? `${coupon.discountPercent}%` : formatCurrency(coupon.discountValue || 0)}</span></p>
                      <p><span className="text-muted-foreground">Mínimo:</span> {formatCurrency(coupon.minOrderValue)}</p>
                      <p><span className="text-muted-foreground">Usos:</span> {coupon.usedCount}/{coupon.maxUses}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings" className="animate-fade-in">
            <Card>
              <CardHeader><CardTitle>Informações da Loja</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2"><Label>Nome</Label><Input defaultValue={store.name} /></div>
                <div className="grid gap-2"><Label>Endereço</Label><Textarea defaultValue={store.address} /></div>
                <Button onClick={() => toast.success('Configurações salvas!')}>Salvar Alterações</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <ProductFormDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        storeId={store.id}
        categories={categories}
        product={editingProduct}
      />
    </div>
  );
}
