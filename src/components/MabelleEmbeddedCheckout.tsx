import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';
import { supabase } from '@/integrations/supabase/client';
import { getStripe, getStripeEnvironment } from '@/lib/stripe';
import type { CartItem, CustomerInfo, DeliveryShift, PaymentMethod } from '@/types';

interface MabelleEmbeddedCheckoutProps {
  storeId: string;
  customer: CustomerInfo;
  items: CartItem[];
  paymentMethod: PaymentMethod;
  deliveryShift: DeliveryShift;
  observations?: string;
  shipping?: { code: string; name: string; price: number; deadline: number };
}

export default function MabelleEmbeddedCheckout(props: MabelleEmbeddedCheckoutProps) {
  const fetchClientSecret = async () => {
    const { data, error } = await supabase.functions.invoke('create-mabelle-checkout', {
      body: {
        ...props,
        environment: getStripeEnvironment(),
        returnUrl: `${window.location.origin}/mabelle/pagamento?session_id={CHECKOUT_SESSION_ID}`,
      },
    });
    if (error || !data?.clientSecret) {
      throw new Error(data?.error || error?.message || 'Não foi possível iniciar o pagamento.');
    }
    return data.clientSecret as string;
  };

  return (
    <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
      <EmbeddedCheckout />
    </EmbeddedCheckoutProvider>
  );
}