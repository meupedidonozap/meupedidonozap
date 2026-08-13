import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del } from "idb-keyval";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { SellerProvider } from "@/contexts/SellerContext";
import HomePage from "./pages/HomePage";
import AdminPage from "./pages/AdminPage";
import StoreAdminPage from "./pages/StoreAdminPage";
import StorePage from "./pages/StorePage";
import CheckoutPage from "./pages/CheckoutPage";
import OrderHistoryPage from "./pages/OrderHistoryPage";
import NotFound from "./pages/NotFound";
import KitchenPage from "./pages/KitchenPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import WaiterPage from "./pages/WaiterPage";
import NoIndex from "./components/NoIndex";
import OfflineBanner from "./components/OfflineBanner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      gcTime: 1000 * 60 * 60 * 24 * 7,
      networkMode: "offlineFirst",
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => get<string>(key).then((v) => v ?? null),
    setItem: (key, value) => set(key, value),
    removeItem: (key) => del(key),
  },
  key: "mpnz-query-cache",
  throttleTime: 2000,
});

const App = () => (
  <HelmetProvider>
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 7 }}
  >
    <TooltipProvider>
      <CartProvider>
        <SellerProvider>
        <Toaster />
        <Sonner />
        <OfflineBanner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/admin" element={<><NoIndex /><AdminPage /></>} />
            <Route path="/redefinir-senha" element={<><NoIndex /><ResetPasswordPage /></>} />
            <Route path="/:slug" element={<StorePage />} />
            <Route path="/:slug/admin" element={<><NoIndex /><StoreAdminPage /></>} />
            <Route path="/:slug/checkout" element={<><NoIndex /><CheckoutPage /></>} />
            <Route path="/:slug/pedidos" element={<><NoIndex /><OrderHistoryPage /></>} />
            <Route path="/:slug/cozinha" element={<><NoIndex /><KitchenPage /></>} />
            <Route path="/:slug/garcom" element={<><NoIndex /><WaiterPage /></>} />
            <Route path="/:slug/redefinir-senha" element={<><NoIndex /><ResetPasswordPage /></>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </SellerProvider>
      </CartProvider>
    </TooltipProvider>
  </PersistQueryClientProvider>
  </HelmetProvider>
);

export default App;
