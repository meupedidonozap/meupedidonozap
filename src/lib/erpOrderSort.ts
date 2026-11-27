/** Número mostrado em "Pedido ERP" na lista de pedidos. */
export const erpOrderNumber = (o: { codigo?: unknown; codigo_importacao?: unknown }) =>
  String(o.codigo_importacao || o.codigo || '').trim();

const day = (o: { data_emissao?: unknown }) => String(o.data_emissao || '').slice(0, 10);
const numeric = (s: string) => (/^\d+$/.test(s) ? Number(s) : null);

/** Emissão mais recente primeiro; no mesmo dia, o maior número de pedido ERP primeiro. */
export function compareErpOrders(a: any, b: any): number {
  const da = day(a), db = day(b);
  if (da !== db) return da < db ? 1 : -1;
  const ca = erpOrderNumber(a), cb = erpOrderNumber(b);
  const na = numeric(ca), nb = numeric(cb);
  if (na !== null && nb !== null) return nb - na;
  if (na !== null) return -1;
  if (nb !== null) return 1;
  return cb.localeCompare(ca);
}

export const sortErpOrders = <T,>(orders: T[]): T[] => [...orders].sort(compareErpOrders);
