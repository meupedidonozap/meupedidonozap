import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "next-themes";
import TechnicalMaterialsPage from './pages/TechnicalMaterialsPage';
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
import SellerPortalPage from "./pages/SellerPortalPage";
import OrderHistoryPage from "./pages/OrderHistoryPage";
import CustomerAccountPage from "./pages/CustomerAccountPage";
import PayOrderPage from "./pages/PayOrderPage";
import CustomerTitlesPage from "./pages/CustomerTitlesPage";
import CustomerInvoicesPage from "./pages/CustomerInvoicesPage";
import NotFound from "./pages/NotFound";
import KitchenPage from "./pages/KitchenPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import WaiterPage from "./pages/WaiterPage";
import NoIndex from "./components/NoIndex";
import OfflineBanner from "./components/OfflineBanner";
import UpdateBanner from "./components/UpdateBanner";
import PaymentReturnPage from "./pages/PaymentReturnPage";
import ReleaseWhatsAppDialog from './components/ReleaseWhatsAppDialog';
import DicoloreDataRefresh from './components/DicoloreDataRefresh';
import CleaningAdminPage from './pages/CleaningAdminPage';
import OrderPdfPreviewDialog from './components/OrderPdfPreviewDialog';
import OrderPriceIssuesDialog from './components/OrderPriceIssuesDialog';
import AndroidPermissionsDialog from './components/AndroidPermissionsDialog';
import TopLoadingBar from './components/TopLoadingBar';
import { installNativeWhatsAppLinks } from './lib/nativeWhatsApp';
import { toast } from 'sonner';
import { isAccessQuery } from './lib/dicoloreMenu';

// APK: WhatsApp links leave the WebView through the native launcher.
installNativeWhatsAppLinks(() => toast.error('Não foi possível abrir o WhatsApp. Copie a mensagem e envie manualmente.'));

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
    persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 7, dehydrateOptions: { shouldDehydrateQuery: query => !isAccessQuery(query.queryKey) && query.state.status === 'success' } }}
  >
    <ThemeProvider attribute="class" defaultTheme="light" storageKey="mpz-theme" enableSystem={false}>
    <TooltipProvider>
      <CartProvider>
        <SellerProvider>
        <Toaster />
        <Sonner />
        <OfflineBanner />
        <BrowserRouter>
          <TopLoadingBar />
          <DicoloreDataRefresh />
          <UpdateBanner />
          <ReleaseWhatsAppDialog />
          <OrderPdfPreviewDialog />
          <OrderPriceIssuesDialog />
          <AndroidPermissionsDialog />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/admin" element={<><NoIndex /><AdminPage /></>} />
            <Route path="/redefinir-senha" element={<><NoIndex /><ResetPasswordPage /></>} />
            <Route path="/:slug" element={<StorePage />} />
            <Route path="/limpa-telhas-brusque/admin" element={<><NoIndex /><CleaningAdminPage /></>} />
            <Route path="/:slug/admin" element={<><NoIndex /><StoreAdminPage /></>} />
            <Route path="/:slug/checkout" element={<><NoIndex /><CheckoutPage /></>} />
            <Route path="/mabelle/pagamento" element={<><NoIndex /><PaymentReturnPage /></>} />
            <Route path="/:slug/meus-dados" element={<><NoIndex /><CustomerAccountPage /></>} />
            <Route path="/:slug/pedidos" element={<><NoIndex /><OrderHistoryPage /></>} />
            <Route path="/:slug/pagar/:orderId" element={<><NoIndex /><PayOrderPage /></>} />
            <Route path="/:slug/titulos" element={<><NoIndex /><CustomerTitlesPage /></>} />
            <Route path="/:slug/notas-fiscais" element={<><NoIndex /><CustomerInvoicesPage /></>} />
            <Route path="/:slug/vendedor/:section?" element={<><NoIndex /><SellerPortalPage /></>} />
            <Route path="/:slug/material-tecnico" element={<TechnicalMaterialsPage />} />
            <Route path="/:slug/cozinha" element={<><NoIndex /><KitchenPage /></>} />
            <Route path="/:slug/garcom" element={<><NoIndex /><WaiterPage /></>} />
            <Route path="/:slug/redefinir-senha" element={<><NoIndex /><ResetPasswordPage /></>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </SellerProvider>
      </CartProvider>
    </TooltipProvider>
    </ThemeProvider>
  </PersistQueryClientProvider>
  </HelmetProvider>
);

export default App;
