// Store types
export type StoreType = 'LOJA' | 'ACESSORIOS' | 'COMIDA' | 'SERVICOS' | 'PIZZARIA' | 'SALAO';

// Salon (SALAO) types
export interface SalonProfessional {
  id: string;
  storeId: string;
  name: string;
  photoUrl?: string;
  bio?: string;
  isActive: boolean;
  sortOrder: number;
}

export interface SalonService {
  id: string;
  storeId: string;
  name: string;
  description: string;
  price: number;
  durationMinutes: number;
  imageUrl?: string;
  isActive: boolean;
  sortOrder: number;
  professionalIds: string[];
}

export type SalonAppointmentStatus = 'reservado' | 'confirmado' | 'concluido' | 'cancelado';

export interface SalonAppointment {
  id: string;
  storeId: string;
  professionalId: string;
  serviceId?: string;
  orderId?: string;
  customerName: string;
  customerWhatsapp?: string;
  startsAt: string;
  endsAt: string;
  status: SalonAppointmentStatus;
  notes?: string;
  createdAt: string;
}

// Pizza types
export interface PizzaSize {
  id: string;
  storeId: string;
  name: string;
  maxFlavors: number;
  price: number;
  sortOrder: number;
  isActive: boolean;
}

export interface PizzaFlavor {
  id: string;
  storeId: string;
  name: string;
  description: string;
  imageUrl?: string;
  categoryId?: string;
  isActive: boolean;
}

export type ServiceOrderStatus = 'aberta' | 'em_andamento' | 'concluida' | 'pago' | 'cancelada';

export interface ServiceOrderExtraItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  quantity: number;
}

export interface ServiceOrder {
  id: string;
  storeId: string;
  orderId?: string;
  osNumber: number;
  customer: CustomerInfo;
  items: CartItem[];
  extraItems: ServiceOrderExtraItem[];
  subtotal: number;
  discount: number;
  total: number;
  status: ServiceOrderStatus;
  observations?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

export interface Store {
  id: string;
  slug: string;
  name: string;
  type: StoreType;
  logo?: string;
  banner?: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  settings: StoreSettings;
  licenseExpiresAt?: string | null;
  sortOrder?: number;
}

export interface ShippingSettings {
  enabled: boolean;
  originCep: string;
  defaultWeight: number;
  defaultLength: number;
  defaultWidth: number;
  defaultHeight: number;
}

export interface StoreSettings {
  primaryColor: string;
  accentColor: string;
  deliveryFee: number;
  minOrderValue: number;
  acceptPix: boolean;
  acceptCard: boolean;
  acceptBoleto: boolean;
  workingHours: WorkingHours;
  discountRules: DiscountRule[];
  shipping?: ShippingSettings;
  theme?: SalonTheme;
  materialApoio?: MaterialApoioSettings;
  deliveryNeighborhoods?: DeliveryNeighborhood[];
  offersDelivery?: boolean;
  /** DiColore: liga/desliga a integração de estoque via planilha. */
  useStockIntegration?: boolean;
  cnpj?: string;
  /** Modos de visualização do catálogo habilitados na vitrine. */
  catalogViewModes?: { list: boolean; grid: boolean };
}

export interface DeliveryNeighborhood {
  id: string;
  name: string;
  fee: number;
}

export interface MaterialApoioSettings {
  enabled: boolean;
  maxPercent: number;
  categoryIds: string[];
}

// Food assembly types
export interface Ingredient {
  id: string;
  storeId: string;
  name: string;
  extraPrice: number;
  isActive: boolean;
  sortOrder: number;
  categoryIds: string[];
}

export interface PizzaBorder {
  id: string;
  storeId: string;
  name: string;
  price: number;
  isActive: boolean;
  sortOrder: number;
}

export type AssemblyMode = 'fixed' | 'remove' | 'choose';

export interface ProductAssembly {
  productId: string;
  mode: AssemblyMode;
  allowObservation: boolean;
  allowBorder: boolean;
  // map of variantId (or 'default') -> max ingredients for that variant/size
  limitsByVariant: Record<string, number>;
  defaultIngredientIds: string[];
}

export type SalonThemePreset = 'masculino' | 'feminino' | 'neutro' | 'custom';

export interface SalonTheme {
  preset: SalonThemePreset;
  primaryHsl?: string; // e.g. "220 80% 30%"
  accentHsl?: string;
}

export interface WorkingHours {
  monday: { open: string; close: string; isOpen: boolean };
  tuesday: { open: string; close: string; isOpen: boolean };
  wednesday: { open: string; close: string; isOpen: boolean };
  thursday: { open: string; close: string; isOpen: boolean };
  friday: { open: string; close: string; isOpen: boolean };
  saturday: { open: string; close: string; isOpen: boolean };
  sunday: { open: string; close: string; isOpen: boolean };
}

export interface DiscountRule {
  id: string;
  type: 'quantity' | 'value' | 'group';
  minQuantity?: number;
  minValue?: number;
  groupId?: string;
  discountPercent: number;
  description: string;
  /** Optional price-table scope (1, 4 or 9). Undefined = applies to all tables. */
  priceTable?: 1 | 4 | 9;
}

// Product types
export interface Category {
  id: string;
  storeId: string;
  name: string;
  order: number;
  commissionPercent?: number;
}

export interface Group {
  id: string;
  storeId: string;
  name: string;
  categoryId: string;
  order: number;
}

export interface ProductVariant {
  id: string;
  color?: string;
  size?: string;
  price: number;
  stock: number;
  sku: string;
  priceTable1?: number;
  priceTable4?: number;
  priceTable9?: number;
}

export interface ProductImage {
  id: string;
  imageUrl: string;
  sortOrder: number;
  label?: string;
}

export interface Product {
  id: string;
  storeId: string;
  code: string;
  name: string;
  description: string;
  categoryId: string;
  groupId?: string;
  basePrice: number;
  priceTable1?: number;
  priceTable4?: number;
  priceTable9?: number;
  image?: string;
  isActive: boolean;
  hasVariants: boolean;
  /** Produto composto por outros produtos (KIT). */
  isKit?: boolean;
  /** Saldo de estoque (sincronizado por planilha na DiColore). */
  stock?: number;
  variants?: ProductVariant[];
  images?: ProductImage[];
  durationMinutes?: number;
  professionalIds?: string[];
}

// Food delivery specific
export interface FoodItem {
  id: string;
  storeId: string;
  name: string;
  description: string;
  categoryId: string;
  price: number;
  image?: string;
  isActive: boolean;
  preparationTime: number; // minutes
  additions?: FoodAddition[];
}

export interface FoodAddition {
  id: string;
  name: string;
  price: number;
}

// Cart types
export interface CartItem {
  productId: string;
  variantId?: string;
  groupId?: string;
  name: string;
  code: string;
  color?: string;
  size?: string;
  price: number;
  quantity: number;
  image?: string;
  additions?: { name: string; price: number }[];
  discountPercent?: number;
  ingredients?: { id: string; name: string; extraPrice: number }[];
  removedIngredients?: { id: string; name: string }[];
  border?: { id: string; name: string; price: number };
  observation?: string;
  /** Preenchido quando o item veio da explosão de um KIT. */
  kitParentCode?: string;
  kitParentName?: string;
}

export interface Cart {
  storeId: string;
  items: CartItem[];
  couponCode?: string;
  couponDiscount: number;
  quantityDiscount: number;
  subtotal: number;
  total: number;
}

// Order types
export type PaymentMethod = 'pix' | 'boleto' | 'cartao' | 'dinheiro';
export type DeliveryShift = 'manha' | 'tarde' | 'noite';
export type OrderStatus = 'pendente' | 'liberado_transmissao' | 'confirmado' | 'preparando' | 'enviado' | 'entregue' | 'cancelado';

export interface CustomerInfo {
  name: string;
  cpfCnpj: string;
  whatsapp: string;
  cep: string;
  uf: string;
  city: string;
  neighborhood: string;
  address: string;
  number: string;
  complement?: string;
  // Dicolore ERP payment codes (optional, persisted in orders.customer jsonb)
  paymentFormaCodigo?: string;
  paymentFormaDescricao?: string;
  paymentCondicaoCodigo?: string;
  paymentCondicaoDescricao?: string;
}

export interface Order {
  id: string;
  storeId: string;
  orderNumber: number;
  customer: CustomerInfo;
  items: CartItem[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  paymentMethod: PaymentMethod;
  deliveryShift: DeliveryShift;
  observations?: string;
  status: OrderStatus;
  origem?: string;
  createdAt: string;
}

// Coupon types
export interface Coupon {
  id: string;
  storeId: string;
  code: string;
  discountPercent?: number;
  discountValue?: number;
  minOrderValue: number;
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  isActive: boolean;
}

// Restaurant tables / tabs
export interface RestaurantTable {
  id: string;
  storeId: string;
  number: number;
  label?: string;
  seats: number;
  isActive: boolean;
}

export type TableSessionStatus = 'aberta' | 'fechada';

export interface TableSession {
  id: string;
  storeId: string;
  tableId: string;
  status: TableSessionStatus;
  openedAt: string;
  closedAt?: string;
  openedBy?: string;
}

export interface TableTab {
  id: string;
  sessionId: string;
  number: number;
  label?: string;
  createdAt: string;
}

export type TabItemStatus = 'pendente' | 'preparo' | 'pronto' | 'entregue' | 'pago' | 'cancelado';

export interface TabItem {
  id: string;
  tabId: string;
  productId?: string;
  variantId?: string;
  name: string;
  code: string;
  unitPrice: number;
  quantity: number;
  ingredients: { id: string; name: string; extraPrice: number }[];
  removedIngredients: { id: string; name: string }[];
  border?: { id: string; name: string; price: number };
  observation?: string;
  status: TabItemStatus;
  paidOrderId?: string;
  image?: string;
  createdAt: string;
}
