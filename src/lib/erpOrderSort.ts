/** Número mostrado em "Pedido ERP" na lista de pedidos. */
export const erpOrderNumber = (o: { codigo?: unknown; codigo_importacao?: unknown; _erp?: unknown }) =>
  String(o._erp || o.codigo_importacao || o.codigo || '').trim();

const pad = (n: number) => String(n).padStart(2, '0');
/** Dia da emissão; horários com fuso (pedidos criados no app) viram o dia local do aparelho. */
const day = (o: { data_emissao?: unknown }) => {
  const s = String(o.data_emissao || '');
  if (/T.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return s.slice(0, 10);
};
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

/** Fila de trabalho: não transmitido, sem OF e sem NF, com OF e sem NF, com OF e com NF, cancelado. */
const STATUS_RANK: Record<string, number> = { L: 0, N: 1, S: 2, F: 3, C: 4 };
const rank = (o: { status?: unknown }) => STATUS_RANK[String(o.status || '')] ?? STATUS_RANK.N;

/** Status primeiro; dentro do mesmo status, emissão mais recente e maior número de pedido ERP. */
export function compareOrdersByStatus(a: any, b: any): number {
  return rank(a) - rank(b) || compareErpOrders(a, b);
}

export const sortOrdersByStatus = <T,>(orders: T[]): T[] => [...orders].sort(compareOrdersByStatus);
