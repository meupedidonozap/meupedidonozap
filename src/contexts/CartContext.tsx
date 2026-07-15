import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { CartItem, Cart, DiscountRule } from '@/types';
import { computeGroupDiscounts } from '@/lib/groupDiscounts';

/**
 * Composite key for grouping cart items. Two items only stack if their
 * assembly (ingredients/removed/border/observation) is identical too.
 */
function cartItemKey(i: CartItem): string {
  const ing = (i.ingredients || []).map(x => x.id).sort().join(',');
  const rem = (i.removedIngredients || []).map(x => x.id).sort().join(',');
  const border = i.border?.id || '';
  const obs = (i.observation || '').trim();
  return `${i.productId}|${i.variantId || ''}|${ing}|${rem}|${border}|${obs}`;
}

interface CartContextType {
  cart: Cart;
  discountRules: DiscountRule[];
  itemDiscounts: Record<string, number>; // key: `${productId}-${variantId|''}` -> discountPercent
  customerPriceTable: 1 | 4 | 9;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, variantId?: string) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  updateItemObservation: (productId: string, observation: string, variantId?: string) => void;
  clearCart: () => void;
  applyCoupon: (code: string, discount: number) => void;
  removeCoupon: () => void;
  setStoreId: (storeId: string) => void;
  setDiscountRules: (rules: DiscountRule[]) => void;
  setCustomerPriceTable: (table: 1 | 4 | 9) => void;
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
  const [customerPriceTable, setCustomerPriceTableState] = useState<1 | 4 | 9>(4);

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
      discountRules,
      customerPriceTable,
    );
    setItemDiscounts(newItemDiscounts);
    setCart(prev => {
      const { subtotal, total } = calculateTotals(prev.items, prev.couponDiscount, quantityDiscount);
      if (prev.quantityDiscount === quantityDiscount && prev.subtotal === subtotal && prev.total === total) {
        return prev;
      }
      return { ...prev, quantityDiscount, subtotal, total };
    });
  }, [cart.items, discountRules, customerPriceTable]);

  const setDiscountRules = useCallback((rules: DiscountRule[]) => {
    setDiscountRulesState(rules);
  }, []);

  const setCustomerPriceTable = useCallback((table: 1 | 4 | 9) => {
    setCustomerPriceTableState((prev) => (prev === table ? prev : table));
  }, []);

  const setStoreId = useCallback((storeId: string) => {
    setCart(prev => {
      if (prev.storeId !== storeId) {
        try {
          const saved = localStorage.getItem(`cart_${storeId}`);
          if (saved) {
            const parsed = JSON.parse(saved) as Cart;
            // Validate shape before trusting it
            if (
              parsed &&
              typeof parsed === 'object' &&
              Array.isArray((parsed as any).items) &&
              typeof (parsed as any).storeId === 'string'
            ) {
              return {
                storeId: parsed.storeId || storeId,
                items: parsed.items.filter(
                  (i: any) =>
                    i &&
                    typeof i.productId === 'string' &&
                    typeof i.name === 'string' &&
                    typeof i.price === 'number' &&
                    typeof i.quantity === 'number'
                ),
                couponCode: parsed.couponCode,
                couponDiscount: Number(parsed.couponDiscount) || 0,
                quantityDiscount: Number(parsed.quantityDiscount) || 0,
                subtotal: Number(parsed.subtotal) || 0,
                total: Number(parsed.total) || 0,
              };
            }
            // Corrupted -> drop it
            try { localStorage.removeItem(`cart_${storeId}`); } catch {}
          }
        } catch {
          try { localStorage.removeItem(`cart_${storeId}`); } catch {}
        }
        return { ...initialCart, storeId };
      }
      return prev;
    });
  }, []);

  const addItem = useCallback((item: CartItem) => {
    setCart(prev => {
      const key = cartItemKey(item);
      const existingIndex = prev.items.findIndex(i => cartItemKey(i) === key);

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

  const updateItemObservation = useCallback((productId: string, observation: string, variantId?: string) => {
    setCart(prev => {
      const newItems = prev.items.map(i =>
        i.productId === productId && i.variantId === variantId ? { ...i, observation } : i
      );
      return { ...prev, items: newItems };
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
        customerPriceTable,
        addItem,
        removeItem,
        updateQuantity,
        updateItemObservation,
        clearCart,
        applyCoupon,
        removeCoupon,
        setStoreId,
        setDiscountRules,
        setCustomerPriceTable,
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
