export interface ExportProfile {
  id?: string;
  customer_code?: string | null;
  cpf_cnpj?: string | null;
  user_id?: string | null;
  seller_code?: string | null;
  transportadora?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

const text = (value: unknown) => String(value ?? '').trim();
const digits = (value: unknown) => text(value).replace(/\D/g, '');

/** An explicit transmitted code must never resolve to another customer's profile. */
export function resolveExportProfile(
  profiles: ExportProfile[],
  customer: { customerCode?: unknown; cpfCnpj?: unknown },
  userId?: string | null,
): ExportProfile | undefined {
  const code = text(customer.customerCode);
  const best = (rows: ExportProfile[]) => [...rows].sort((a, b) => {
    const completeness = (p: ExportProfile) =>
      Number(Boolean(text(p.seller_code))) + Number(Boolean(text(p.transportadora)));
    return completeness(b) - completeness(a)
      || text(b.updated_at).localeCompare(text(a.updated_at))
      || text(a.id).localeCompare(text(b.id));
  })[0];
  if (code) return best(profiles.filter(p => text(p.customer_code) === code));

  // Legacy orders may omit the code. Recover it only from an unambiguous
  // ERP registration, never from a blank-code duplicate login profile.
  const doc = digits(customer.cpfCnpj);
  const registered = profiles.filter(p => text(p.customer_code));
  const unique = (rows: ExportProfile[]) =>
    new Set(rows.map(p => text(p.customer_code))).size === 1 ? best(rows) : undefined;
  if (doc.length === 11 || doc.length === 14) {
    const matching = registered.filter(p => digits(p.cpf_cnpj) === doc);
    if (matching.length) return unique(matching);
  }
  return userId ? unique(registered.filter(p => p.user_id === userId)) : undefined;
}