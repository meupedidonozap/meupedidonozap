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
  if (c.claimedRole === 'televendas' || c.claimedRole === 'vendedor') return { role: c.claimedRole, name: String(c.claimedName || '') };
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
  if (isUnclaimedCustomerOrder(order as any)) return true;
  const owner = getOrderOwner(order);
  if (!owner.role) return false;
  const viewerRole = viewer.isTelevendas ? 'televendas' : 'vendedor';
  if (owner.role !== viewerRole) return false;
  if (owner.role === 'televendas') {
    const oc = String(order.customer?.televendasErpCode || '').trim();
    const vc = String(viewer.erpCode || '').trim();
    const cc = order.customer?.claimedRole ? String(order.customer?.claimedErpCode || '').trim() : oc;
    if (cc && vc) return cc === vc;
    if (owner.name && viewer.name) return norm(owner.name) === norm(viewer.name);
  }
  return true;
}

/** Pedido emitido pelo próprio cliente que ainda não foi assumido: vendedor e televendas podem editar. */
export function isUnclaimedCustomerOrder(order: { origem?: string | null; customer?: any; userId?: string | null } | null | undefined): boolean {
  const c = order?.customer || {};
  return isClientCreated(order) && !c.claimedRole;
}

/** Pedido iniciado pelo cliente: marcado como cliente, ou pedido antigo da loja (web) sem criador nem dono (ex.: #749). */
export function isClientCreated(order: { origem?: string | null; customer?: any; userId?: string | null } | null | undefined): boolean {
  const c = order?.customer || {};
  if (c.createdByRole === 'cliente') return true;
  if (c.createdByRole || c.isTelevendas || c.ownerRole) return false;
  return order?.origem === 'web' && !!(order.userId ?? (order as any).user_id);
}

/** Campos de criação/dono que uma edição nunca pode sobrescrever. */
const ORIGIN_KEYS = ['createdByRole', 'createdByName', 'createdByUserEmail', 'claimedRole', 'claimedName', 'claimedErpCode', 'claimedAt',
  'ownerRole', 'ownerName', 'isTelevendas', 'televendasName', 'televendasErpCode'] as const;

/**
 * Monta o cliente a salvar numa edição: dados novos do formulário, mas mantendo
 * quem criou e quem assumiu do pedido salvo. Se o pedido é do cliente e ainda
 * não tem dono, quem está salvando assume.
 */
export function mergeEditedCustomer(
  saved: { origem?: string | null; customer?: any; userId?: string | null },
  edited: any,
  viewer: { isAdmin?: boolean; isTelevendas?: boolean; name?: string; erpCode?: string },
): any {
  const prev = saved.customer || {};
  const out: any = { ...edited };
  for (const k of ORIGIN_KEYS) { if (k in prev) out[k] = prev[k]; else delete out[k]; }
  if (isClientCreated(saved) && !prev.createdByRole) { out.createdByRole = 'cliente'; out.createdByName = out.createdByName || prev.name; }
  return claimCustomerOrder(out, viewer);
}

/** Ao editar um pedido do cliente, quem editar primeiro vira o dono. */
export function claimCustomerOrder(customer: any, viewer: { isAdmin?: boolean; isTelevendas?: boolean; name?: string; erpCode?: string }): any {
  const c = customer || {};
  if (c.createdByRole !== 'cliente' || c.claimedRole || viewer.isAdmin || !viewer.name) return c;
  const tv = !!viewer.isTelevendas;
  return {
    ...c,
    claimedRole: tv ? 'televendas' : 'vendedor',
    claimedName: viewer.name,
    claimedErpCode: tv ? (viewer.erpCode || undefined) : undefined,
    claimedAt: new Date().toISOString(),
    ownerRole: tv ? 'televendas' : 'vendedor',
    ownerName: viewer.name,
    isTelevendas: tv ? true : undefined,
    televendasName: tv ? viewer.name : undefined,
    televendasErpCode: tv ? (viewer.erpCode || undefined) : undefined,
  };
}
