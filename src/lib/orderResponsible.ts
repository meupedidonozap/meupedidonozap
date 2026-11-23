import { isClientCreated } from './orderOwnership';

export function canManageOrderResponsible(slug: string | undefined, viewer: { isAdmin?: boolean; isManager?: boolean; loading?: boolean }) {
  return slug === 'dicolore' && !viewer.loading && (viewer.isAdmin === true || viewer.isManager === true);
}

export function canChangeOrderResponsible(order: { status: string; xmlDownloadedAt?: string | null; erpSentAt?: string | null; erpOrderCode?: string | null }) {
  return ['pendente', 'orcamento'].includes(order.status) && !order.xmlDownloadedAt && !order.erpSentAt && !order.erpOrderCode;
}

export const canUnlinkOrderResponsible = isClientCreated;