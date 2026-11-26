/** Pergunta de check-in ao selecionar o cliente: só com força de vendas ativa e sem visita aberta no mesmo cliente. */
export function shouldOfferCheckin(input: { salesForceOn: boolean; customerId?: string | null; openVisitCustomerId?: string | null }) {
  if (!input.salesForceOn || !input.customerId) return false;
  return input.openVisitCustomerId !== input.customerId;
}
