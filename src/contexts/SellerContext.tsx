import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import type { CustomerProfile } from '@/hooks/useCustomerProfile';

export type SellerCustomer = CustomerProfile & { customerCode?: string };

interface SellerContextType {
  selectedCustomer: SellerCustomer | null;
  selectCustomer: (c: SellerCustomer | null) => void;
  clearSelectedCustomer: () => void;
}

const SellerContext = createContext<SellerContextType | undefined>(undefined);
const STORAGE_KEY = 'seller_selected_customer';

export function SellerProvider({ children }: { children: ReactNode }) {
  const [selectedCustomer, setSelectedCustomer] = useState<SellerCustomer | null>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as SellerCustomer) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (selectedCustomer) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selectedCustomer));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  }, [selectedCustomer]);

  const selectCustomer = useCallback((c: SellerCustomer | null) => setSelectedCustomer(c), []);
  const clearSelectedCustomer = useCallback(() => setSelectedCustomer(null), []);

  return (
    <SellerContext.Provider value={{ selectedCustomer, selectCustomer, clearSelectedCustomer }}>
      {children}
    </SellerContext.Provider>
  );
}

export function useSellerContext() {
  const ctx = useContext(SellerContext);
  if (!ctx) throw new Error('useSellerContext must be used within a SellerProvider');
  return ctx;
}
