import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { CartItem, Cart, DiscountRule } from '@/types';

interface CartContextType {
  cart: Cart;
  discountRules: DiscountRule[];
  itemDiscounts: Record<string, number>; // key: `${productId}-${variantId|''}` -> discountPercent
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, variantId?: string) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  applyCoupon: (code: string, discount: number) => void;
  removeCoupon: () => void;
  setStoreId: (storeId: string) => void;
  setDiscountRules: (rules: DiscountRule[]) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const initialCart: Cart = {
  storeId: '',
  items: [],
  couponCode: undefined,
  couponDiscount: 0,
  quantityDiscount: 0,
  subtotal: 0,
  total: 0,
};

function computeGroupDiscounts(
  items: CartItem[],
  rules: DiscountRule[]
): { quantityDiscount: number; itemDiscounts: Record<string, number> } {
  const groupRules = rules.filter(r => r.type === 'group');
  let totalDiscount = 0;
  const itemDiscounts: Record<string, number> = {};

  if (groupRules.length === 0) return { quantityDiscount: 0, itemDiscounts };

  // Group items by groupId
  const groupMap = new Map<string, CartItem[]>();
  for (const item of items) {
    if (!item.groupId) continue;
    const list = groupMap.get(item.groupId) || [];
    list.push(item);
    groupMap.set(item.groupId, list);
  }

  for (const [groupId, groupItems] of groupMap) {
    const totalQty = groupItems.reduce((s, i) => s + i.quantity, 0);
    // Find the best applicable tier
    const applicable = groupRules
      .filter(r => r.groupId === groupId && (r.minQuantity || 0) <= totalQty)
      .sort((a, b) => (b.minQuantity || 0) - (a.minQuantity || 0))[0];

    if (!applicable) continue;

    const pct = applicable.discountPercent / 100;
    for (const item of groupItems) {
      const key = `${item.productId}-${item.variantId || ''}`;
      itemDiscounts[key] = applicable.discountPercent;
      totalDiscount += item.price * item.quantity * pct;
    }
  }

  return { quantityDiscount: totalDiscount, itemDiscounts };
}

const calculateTotals = (
  items: CartItem[],
  couponDiscount: number,
  quantityDiscount: number
): { subtotal: number; total: number } => {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = Math.max(0, subtotal - couponDiscount - quantityDiscount);
  return { subtotal, total };
};

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>(initialCart);
  const [discountRules, setDiscountRulesState] = useState<DiscountRule[]>([]);
  const [itemDiscounts, setItemDiscounts] = useState<Record<string, number>>({});

  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    if (cart.storeId) {
      localStorage.setItem(`cart_${cart.storeId}`, JSON.stringify(cart));
    }
  }, [cart]);

  // Recompute group discounts whenever items or rules change
  useEffect(() => {
    const { quantityDiscount, itemDiscounts: newItemDiscounts } = computeGroupDiscounts(
      cart.items,
      discountRules
    );
    setItemDiscounts(newItemDiscounts);
    setCart(prev => {
      const { subtotal, total } = calculateTotals(prev.items, prev.couponDiscount, quantityDiscount);
      if (prev.quantityDiscount === quantityDiscount && prev.subtotal === subtotal && prev.total === total) {
        return prev;
      }
      return { ...prev, quantityDiscount, subtotal, total };
    });
  }, [cart.items, discountRules]);

  const setDiscountRules = useCallback((rules: DiscountRule[]) => {
    setDiscountRulesState(rules);
  }, []);

  const setStoreId = useCallback((storeId: string) => {
    setCart(prev => {
      if (prev.storeId !== storeId) {
        try {
          const saved = localStorage.getItem(`cart_${storeId}`);
          if (saved) {
            const parsed = JSON.parse(saved) as Cart;
            return parsed;
          }
        } catch {}
        return { ...initialCart, storeId };
      }
      return prev;
    });
  }, []);

  const addItem = useCallback((item: CartItem) => {
    setCart(prev => {
      const existingIndex = prev.items.findIndex(
        i => i.productId === item.productId && i.variantId === item.variantId
      );

      let newItems: CartItem[];
      if (existingIndex >= 0) {
        newItems = [...prev.items];
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          quantity: newItems[existingIndex].quantity + item.quantity,
        };
      } else {
        newItems = [...prev.items, item];
      }

      const { subtotal, total } = calculateTotals(newItems, prev.couponDiscount, prev.quantityDiscount);
      return { ...prev, items: newItems, subtotal, total };
    });
  }, []);

  const removeItem = useCallback((productId: string, variantId?: string) => {
    setCart(prev => {
      const newItems = prev.items.filter(
        i => !(i.productId === productId && i.variantId === variantId)
      );
      const { subtotal, total } = calculateTotals(newItems, prev.couponDiscount, prev.quantityDiscount);
      return { ...prev, items: newItems, subtotal, total };
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number, variantId?: string) => {
    setCart(prev => {
      if (quantity <= 0) {
        const newItems = prev.items.filter(
          i => !(i.productId === productId && i.variantId === variantId)
        );
        const { subtotal, total } = calculateTotals(newItems, prev.couponDiscount, prev.quantityDiscount);
        return { ...prev, items: newItems, subtotal, total };
      }

      const newItems = prev.items.map(i =>
        i.productId === productId && i.variantId === variantId ? { ...i, quantity } : i
      );
      const { subtotal, total } = calculateTotals(newItems, prev.couponDiscount, prev.quantityDiscount);
      return { ...prev, items: newItems, subtotal, total };
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart(prev => {
      localStorage.removeItem(`cart_${prev.storeId}`);
      return { ...initialCart, storeId: prev.storeId };
    });
  }, []);

  const applyCoupon = useCallback((code: string, discount: number) => {
    setCart(prev => {
      const { subtotal, total } = calculateTotals(prev.items, discount, prev.quantityDiscount);
      return { ...prev, couponCode: code, couponDiscount: discount, subtotal, total };
    });
  }, []);

  const removeCoupon = useCallback(() => {
    setCart(prev => {
      const { subtotal, total } = calculateTotals(prev.items, 0, prev.quantityDiscount);
      return { ...prev, couponCode: undefined, couponDiscount: 0, subtotal, total };
    });
  }, []);

  return (
    <CartContext.Provider
      value={{
        cart,
        discountRules,
        itemDiscounts,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        applyCoupon,
        removeCoupon,
        setStoreId,
        setDiscountRules,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
