import type { PaymentMethod } from '@/types';

type PaymentSettings = {
  acceptPix?: boolean;
  acceptCard?: boolean;
  acceptBoleto?: boolean;
  onlinePayments?: boolean;
  paymentGateway?: {
    pixEnabled?: boolean;
    cardEnabled?: boolean;
  };
};

/** DiColore só exibe recebimentos quando a loja ativa PIX ou cartão explicitamente. */
export function canShowPaymentReceipts(slug?: string | null, settings?: PaymentSettings | null): boolean {
  if (slug !== 'dicolore') return true;
  return settings?.paymentGateway?.pixEnabled === true || settings?.paymentGateway?.cardEnabled === true;
}

/**
 * O cartão Recebimento por PIX e Cartão é a configuração atual. Quando uma
 * flag existe ali, ela substitui a flag antiga; lojas ainda não migradas
 * continuam usando acceptPix/acceptCard.
 */
export function getAvailablePaymentMethods(settings?: PaymentSettings | null): PaymentMethod[] {
  const gateway = settings?.paymentGateway;
  const pix = typeof gateway?.pixEnabled === 'boolean' ? gateway.pixEnabled : settings?.acceptPix === true;
  const card = typeof gateway?.cardEnabled === 'boolean' ? gateway.cardEnabled : settings?.acceptCard === true;
  const methods: PaymentMethod[] = [];

  if (pix) methods.push('pix');
  if (settings?.acceptBoleto === true) methods.push('boleto');
  if (card) methods.push('cartao');
  if (settings?.onlinePayments !== true) methods.push('dinheiro');

  return methods;
}
