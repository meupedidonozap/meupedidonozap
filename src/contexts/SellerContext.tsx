import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

  // Limpa o cliente ao sair do sistema ou ao entrar com outro usuário.
  useEffect(() => {
    const OWNER_KEY = 'seller_selected_customer_owner';
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const uid = session?.user?.id ?? null;
      if (event === 'SIGNED_OUT' || !uid) {
        setSelectedCustomer(null);
        try { sessionStorage.removeItem(OWNER_KEY); } catch { /* ignore */ }
        return;
      }
      try {
        const owner = sessionStorage.getItem(OWNER_KEY);
        if (owner && owner !== uid) setSelectedCustomer(null);
        sessionStorage.setItem(OWNER_KEY, uid);
      } catch { /* ignore */ }
    });
    return () => subscription.unsubscribe();
  }, []);

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
