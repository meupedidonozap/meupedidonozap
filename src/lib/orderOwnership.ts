/** Pedido/orçamento iniciado pelo próprio cliente (não por vendedor/televendas). */
export function isCustomerOrder(order: { origem?: string | null; customer?: any } | null | undefined): boolean {
  if (!order) return false;
  const role = order.customer?.createdByRole;
  if (role === 'vendedor' || role === 'televendas') return false;
  if (role === 'cliente') return true;
  return order.origem !== 'vendedor';
}

export type OrderOwnerRole = 'vendedor' | 'televendas' | null;

/** Quem é o "dono" do pedido: quem iniciou, ou quem o cliente escolheu no envio. */
export function getOrderOwner(order: { origem?: string | null; customer?: any } | null | undefined): { role: OrderOwnerRole; name: string } {
  const c = order?.customer || {};
  const role = c.ownerRole || c.createdByRole;
  if (role === 'televendas' || role === 'vendedor') {
    return { role, name: String(c.ownerName || (role === 'televendas' ? c.televendasName : c.createdByName) || '') };
  }
  if (!c.createdByRole && order?.origem === 'vendedor') return { role: 'vendedor', name: String(c.sellerUserName || '') };
  return { role: null, name: '' };
}

/** Normaliza nome ignorando acentos, maiúsculas, ordem das palavras e a palavra "televendas". */
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .split(/[^a-z0-9]+/).filter(w => w && w !== 'televendas' && w !== 'tele' && w !== 'vendas').sort().join(' ');

/** Apenas o dono (ou admin) edita/finaliza. Os demais da carteira só visualizam. */
export function canEditOrder(
  order: { origem?: string | null; customer?: any } | null | undefined,
  viewer: { isAdmin?: boolean; isTelevendas?: boolean; name?: string; erpCode?: string },
): boolean {
  if (!order) return false;
  if (viewer.isAdmin) return true;
  const owner = getOrderOwner(order);
  if (!owner.role) return false;
  const viewerRole = viewer.isTelevendas ? 'televendas' : 'vendedor';
  if (owner.role !== viewerRole) return false;
  if (owner.role === 'televendas') {
    const oc = String(order.customer?.televendasErpCode || '').trim();
    const vc = String(viewer.erpCode || '').trim();
    if (oc && vc) return oc === vc;
    if (owner.name && viewer.name) return norm(owner.name) === norm(viewer.name);
  }
  return true;
}
