const norm = (c: unknown) => String(c ?? '').trim().replace(/^0+(?=\d)/, '');

export interface TvInvoice { filial_codigo: string; pedido_codigo: string; }
export interface TvOrder { external_key: string; pedido_televendas: boolean; televendas_codigo: string | null; }

/** Chaves filial|pedido emitidas pela operadora (pedtelven = S e pedotvcod = código dela). */
export function televendasOrderKeys(orders: TvOrder[], operatorCode: string): Set<string> {
  const me = norm(operatorCode);
  return new Set(orders.filter(o => o.pedido_televendas && (!me || norm(o.televendas_codigo) === me)).map(o => o.external_key));
}

/** NF pertence ao televendas quando o pedido dela foi emitido pela operadora. */
export function isTelevendasInvoice(inv: TvInvoice, keys: Set<string>): boolean {
  if (!inv.pedido_codigo || inv.pedido_codigo === '0') return false;
  return keys.has(`${inv.filial_codigo}|${inv.pedido_codigo}`);
}
