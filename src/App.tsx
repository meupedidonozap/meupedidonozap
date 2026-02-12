import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import HomePage from "./pages/HomePage";
import AdminPage from "./pages/AdminPage";
import StoreAdminPage from "./pages/StoreAdminPage";
import StorePage from "./pages/StorePage";
import CheckoutPage from "./pages/CheckoutPage";
import OrderHistoryPage from "./pages/OrderHistoryPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CartProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/:slug" element={<StorePage />} />
            <Route path="/:slug/admin" element={<StoreAdminPage />} />
            <Route path="/:slug/checkout" element={<CheckoutPage />} />
            <Route path="/:slug/pedidos" element={<OrderHistoryPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
