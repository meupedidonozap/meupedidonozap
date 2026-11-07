/** Payment belongs to the saved order, never to the reusable product cart. */
export function orderPaymentSelection(customer: unknown) {
  const c = customer && typeof customer === 'object'
    ? customer as Record<string, unknown> : {};
  return {
    formaCodigo: String(c.paymentFormaCodigo ?? ''),
    condicaoCodigo: String(c.paymentCondicaoCodigo ?? ''),
  };
}