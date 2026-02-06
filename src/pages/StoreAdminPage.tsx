import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Settings,
  Tags,
  Percent,
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Eye,
  Printer,
  CheckCircle,
  Clock,
  Truck,
  XCircle,
} from 'lucide-react';
import {
  getStoreBySlug,
  getCategoriesByStore,
  getProductsByStore,
  getFoodItemsByStore,
  getOrdersByStore,
  getCouponsByStore,
} from '@/data/mockData';
import type { OrderStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  const store = getStoreBySlug(slug || '');
  const [activeTab, setActiveTab] = useState('dashboard');

  if (!store) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Loja não encontrada</h1>
          <p className="text-muted-foreground">Verifique o endereço e tente novamente</p>
          <Button asChild className="mt-4">
            <Link to="/admin">Voltar ao Admin</Link>
          </Button>
        </div>
      </div>
    );
  }

  const categories = getCategoriesByStore(store.id);
  const products = store.type === 'COMIDA' ? getFoodItemsByStore(store.id) : getProductsByStore(store.id);
  const orders = getOrdersByStore(store.id);
  const coupons = getCouponsByStore(store.id);

  const stats = {
    totalProducts: products.length,
    totalOrders: orders.length,
    pendingOrders: orders.filter(o => o.status === 'pendente').length,
    todayRevenue: orders
      .filter(o => new Date(o.createdAt).toDateString() === new Date().toDateString())
      .reduce((sum, o) => sum + o.total, 0),
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-primary text-primary-foreground">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild className="text-primary-foreground hover:bg-primary-foreground/10">
                <Link to="/admin">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div>
                <h1 className="text-xl font-bold">{store.name}</h1>
                <p className="text-sm text-primary-foreground/80">Painel da Loja</p>
              </div>
            </div>
            <Button variant="outline" asChild className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
              <Link to={`/${store.slug}`}>
                <Eye className="mr-2 h-4 w-4" />
                Ver Loja
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex flex-wrap h-auto gap-1">
            <TabsTrigger value="dashboard" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-2">
              <Package className="h-4 w-4" />
              Produtos
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <Tags className="h-4 w-4" />
              Categorias
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Pedidos
              {stats.pendingOrders > 0 && (
                <Badge className="ml-1 bg-destructive text-destructive-foreground">
                  {stats.pendingOrders}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="coupons" className="gap-2">
              <Percent className="h-4 w-4" />
              Cupons
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Configurações
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="animate-fade-in">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total de Produtos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.totalProducts}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total de Pedidos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.totalOrders}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Pedidos Pendentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-warning">{stats.pendingOrders}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Faturamento Hoje
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">{formatCurrency(stats.todayRevenue)}</div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Orders */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Pedidos Recentes</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Itens</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.slice(0, 5).map(order => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">#{order.orderNumber}</TableCell>
                        <TableCell>{order.customer.name}</TableCell>
                        <TableCell>{order.items.length} itens</TableCell>
                        <TableCell>{formatCurrency(order.total)}</TableCell>
                        <TableCell>
                          <Badge className={statusConfig[order.status].color}>
                            {statusConfig[order.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDateTime(order.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="animate-fade-in">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Produtos</h3>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Produto
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
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
                        <TableCell className="font-mono text-sm">
                          {'code' in product ? product.code : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {product.image && (
                              <img
                                src={product.image}
                                alt={product.name}
                                className="h-10 w-10 rounded object-cover"
                              />
                            )}
                            <div>
                              <p className="font-medium">{product.name}</p>
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {product.description}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {categories.find(c => c.id === product.categoryId)?.name || '-'}
                        </TableCell>
                        <TableCell>
                          {formatCurrency('basePrice' in product ? product.basePrice : product.price)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={product.isActive ? 'default' : 'secondary'}>
                            {product.isActive ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon">
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="animate-fade-in">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Categorias</h3>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Categoria
              </Button>
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
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="animate-fade-in">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Pedidos</h3>
              <div className="flex gap-2">
                <Select defaultValue="all">
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filtrar status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="confirmado">Confirmado</SelectItem>
                    <SelectItem value="preparando">Preparando</SelectItem>
                    <SelectItem value="enviado">Enviado</SelectItem>
                    <SelectItem value="entregue">Entregue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Endereço</TableHead>
                      <TableHead>Itens</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map(order => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">#{order.orderNumber}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(order.createdAt)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{order.customer.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {order.customer.whatsapp}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <p className="truncate text-sm">
                            {order.customer.address}, {order.customer.neighborhood}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {order.customer.city}/{order.customer.uf}
                          </p>
                        </TableCell>
                        <TableCell>{order.items.length} itens</TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(order.total)}
                        </TableCell>
                        <TableCell className="uppercase text-xs">
                          {order.paymentMethod}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusConfig[order.status].color}>
                            {statusConfig[order.status].icon}
                            <span className="ml-1">{statusConfig[order.status].label}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toast.info('Visualizar pedido')}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toast.success('Pedido enviado para impressão')}
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Coupons Tab */}
          <TabsContent value="coupons" className="animate-fade-in">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Cupons de Desconto</h3>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Cupom
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {coupons.map(coupon => (
                <Card key={coupon.id}>
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <Badge variant="outline" className="font-mono text-lg">
                        {coupon.code}
                      </Badge>
                      <Badge variant={coupon.isActive ? 'default' : 'secondary'}>
                        {coupon.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p>
                        <span className="text-muted-foreground">Desconto:</span>{' '}
                        <span className="font-medium">
                          {coupon.discountPercent
                            ? `${coupon.discountPercent}%`
                            : formatCurrency(coupon.discountValue || 0)}
                        </span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Mínimo:</span>{' '}
                        {formatCurrency(coupon.minOrderValue)}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Usos:</span>{' '}
                        {coupon.usedCount}/{coupon.maxUses}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Expira:</span>{' '}
                        {coupon.expiresAt}
                      </p>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Edit2 className="mr-1 h-3 w-3" />
                        Editar
                      </Button>
                      <Button variant="outline" size="sm" className="text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="animate-fade-in">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Informações da Loja</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Nome</Label>
                    <Input defaultValue={store.name} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Endereço</Label>
                    <Textarea defaultValue={store.address} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Telefone</Label>
                      <Input defaultValue={store.phone} />
                    </div>
                    <div className="grid gap-2">
                      <Label>WhatsApp</Label>
                      <Input defaultValue={store.whatsapp} />
                    </div>
                  </div>
                  <Button onClick={() => toast.success('Configurações salvas!')}>
                    Salvar Alterações
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Configurações de Entrega</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Taxa de Entrega</Label>
                      <Input type="number" defaultValue={store.settings.deliveryFee} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Pedido Mínimo</Label>
                      <Input type="number" defaultValue={store.settings.minOrderValue} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Formas de Pagamento</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" defaultChecked={store.settings.acceptPix} />
                        PIX
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" defaultChecked={store.settings.acceptCard} />
                        Cartão
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" defaultChecked={store.settings.acceptBoleto} />
                        Boleto
                      </label>
                    </div>
                  </div>
                  <Button onClick={() => toast.success('Configurações salvas!')}>
                    Salvar Alterações
                  </Button>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Regras de Desconto por Quantidade</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Condição</TableHead>
                        <TableHead>Desconto</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {store.settings.discountRules.map(rule => (
                        <TableRow key={rule.id}>
                          <TableCell className="capitalize">{rule.type}</TableCell>
                          <TableCell>
                            {rule.type === 'quantity' && `${rule.minQuantity}+ itens`}
                            {rule.type === 'value' && formatCurrency(rule.minValue || 0)}
                            {rule.type === 'group' && `Grupo ${rule.groupId}`}
                          </TableCell>
                          <TableCell>{rule.discountPercent}%</TableCell>
                          <TableCell>{rule.description}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Button variant="outline" className="mt-4 gap-2">
                    <Plus className="h-4 w-4" />
                    Adicionar Regra
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
