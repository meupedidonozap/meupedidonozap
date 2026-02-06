// Store types
export type StoreType = 'LOJA' | 'ACESSORIOS' | 'COMIDA';

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
}

// Product types
export interface Category {
  id: string;
  storeId: string;
  name: string;
  order: number;
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
  image?: string;
  isActive: boolean;
  hasVariants: boolean;
  variants?: ProductVariant[];
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
  name: string;
  code: string;
  color?: string;
  size?: string;
  price: number;
  quantity: number;
  image?: string;
  additions?: { name: string; price: number }[];
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
export type OrderStatus = 'pendente' | 'confirmado' | 'preparando' | 'enviado' | 'entregue' | 'cancelado';

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
