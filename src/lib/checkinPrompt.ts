/**
 * Pergunta de check-in ao selecionar o cliente: só para o perfil Vendedor (não televendas, gerente ou
 * administrador), com força de vendas ativa e sem visita aberta no mesmo cliente.
 */
export function shouldOfferCheckin(input: { salesForceOn: boolean; isFieldSeller: boolean; customerId?: string | null; openVisitCustomerId?: string | null }) {
  if (!input.salesForceOn || !input.isFieldSeller || !input.customerId) return false;
  return input.openVisitCustomerId !== input.customerId;
}
