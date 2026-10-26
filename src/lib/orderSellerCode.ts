/** Resolve o código do vendedor (representante) que vai no arquivo do pedido. */
export interface SellerLookups {
  storeUsers?: { name?: string; seller_codes?: string[] | null; erp_code?: string | null; role?: string }[];
  sellers?: { name?: string; code?: string | null }[];
}

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

export function resolveOrderSellerCode(
  profileSellerCode: unknown,
  customer: any,
  lookups: SellerLookups = {},
): { code: string; name: string } {
  const byCode = (code: string) =>
    (lookups.sellers || []).find(s => String(s.code || '').trim() === code)?.name || '';
  const p = String(profileSellerCode ?? '').trim();
  if (p) return { code: p, name: byCode(p) };
  const o = String(customer?.sellerCode ?? '').trim();
  if (o) return { code: o, name: byCode(o) };
  const role = customer?.ownerRole || customer?.createdByRole;
  const creator = norm(customer?.ownerName || customer?.createdByName);
  if (creator && role === 'vendedor') {
    const u = (lookups.storeUsers || []).find(x => norm(x.name) === creator);
    const c = String(u?.seller_codes?.[0] || '').trim();
    if (c) return { code: c, name: byCode(c) || String(u?.name || '') };
  }
  const chosen = norm(customer?.sellerName || creator);
  if (chosen) {
    const s = (lookups.sellers || []).find(x => norm(x.name) === chosen);
    if (s?.code) return { code: String(s.code).trim(), name: String(s.name || '') };
  }
  return { code: '', name: '' };
}
