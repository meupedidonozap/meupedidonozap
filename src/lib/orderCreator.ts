export type OrderCreatorRole = 'cliente' | 'vendedor' | 'televendas' | 'admin';

export const CREATOR_LABEL: Record<OrderCreatorRole, string> = {
  cliente: 'Feito pelo cliente',
  vendedor: 'Feito por vendedor',
  televendas: 'Feito por televendas',
  admin: 'Painel / Admin',
};

/** Quem INICIOU o pedido. Só conta como "cliente" quando gravado explicitamente como cliente. */
export function getOrderCreator(order: { origem?: string | null; customer?: any } | null | undefined): {
  role: OrderCreatorRole; name: string; login: string;
} {
  const c = order?.customer || {};
  let role: OrderCreatorRole = 'admin';
  if (c.createdByRole === 'cliente' || c.createdByRole === 'vendedor' || c.createdByRole === 'televendas') role = c.createdByRole;
  else if (c.isTelevendas) role = 'televendas';
  else if (order?.origem === 'vendedor') role = 'vendedor';
  const name = String(c.createdByName || (role === 'televendas' ? c.televendasName : '') || (role === 'cliente' ? c.name : '') || '');
  const login = String(c.createdByUserEmail || (role === 'cliente' ? (c.customerCode || '') : '') || '');
  return { role, name, login };
}
