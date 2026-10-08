/** Pedido/orçamento iniciado pelo próprio cliente (não por vendedor/televendas). */
export function isCustomerOrder(order: { origem?: string | null; customer?: any } | null | undefined): boolean {
  if (!order) return false;
  const role = order.customer?.createdByRole;
  if (role === 'vendedor' || role === 'televendas') return false;
  if (role === 'cliente') return true;
  return order.origem !== 'vendedor';
}
