import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { CartItem, Cart } from '@/types';

interface CartContextType {
  cart: Cart;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, variantId?: string) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  applyCoupon: (code: string, discount: number) => void;
  removeCoupon: () => void;
  setStoreId: (storeId: string) => void;
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

const calculateTotals = (items: CartItem[], couponDiscount: number, quantityDiscount: number): { subtotal: number; total: number } => {
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = Math.max(0, subtotal - couponDiscount - quantityDiscount);
  return { subtotal, total };
};

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>(initialCart);

  const setStoreId = useCallback((storeId: string) => {
    setCart(prev => {
      if (prev.storeId !== storeId) {
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
        i.productId === productId && i.variantId === variantId
          ? { ...i, quantity }
          : i
      );
      const { subtotal, total } = calculateTotals(newItems, prev.couponDiscount, prev.quantityDiscount);
      return { ...prev, items: newItems, subtotal, total };
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart(prev => ({ ...initialCart, storeId: prev.storeId }));
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
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        applyCoupon,
        removeCoupon,
        setStoreId,
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
