import { resolveExportProfile, type ExportProfile } from '../../supabase/functions/_shared/customerExportProfile';

interface Profile {
  id: string;
  userId?: string | null;
  customerCode?: string | null;
  cpfCnpj?: string | null;
  sellerCode?: string | null;
  transportadora?: string | null;
}

const text = (v: unknown) => String(v ?? '').trim();
const digits = (v: unknown) => text(v).replace(/\D/g, '');

/** Build once per customer-list change; preserve the ERP resolver's identity rules. */
export function buildOrderProfileIndex<T extends Profile>(profiles: T[]) {
  const byId = new Map<string, T>();
  const byCode = new Map<string, ExportProfile[]>();
  const byDoc = new Map<string, ExportProfile[]>();
  const byUser = new Map<string, ExportProfile[]>();
  const add = (index: Map<string, ExportProfile[]>, key: string, row: ExportProfile) => {
    if (!key) return;
    const bucket = index.get(key);
    if (bucket) bucket.push(row);
    else index.set(key, [row]);
  };
  for (const p of profiles) {
    byId.set(p.id, p);
    const row: ExportProfile = {
      id: p.id, user_id: p.userId, customer_code: p.customerCode,
      cpf_cnpj: p.cpfCnpj, seller_code: p.sellerCode, transportadora: p.transportadora,
    };
    add(byCode, text(p.customerCode), row);
    if (text(p.customerCode)) {
      add(byDoc, digits(p.cpfCnpj), row);
      add(byUser, text(p.userId), row);
    }
  }
  return (order: { customer?: { customerCode?: unknown; cpfCnpj?: unknown }; userId?: string | null } | null | undefined): T | undefined => {
    const customer = order?.customer || {};
    const code = text(customer.customerCode);
    const doc = digits(customer.cpfCnpj);
    const docMatches = doc.length === 11 || doc.length === 14 ? byDoc.get(doc) : undefined;
    const candidates = code ? byCode.get(code) : docMatches || byUser.get(text(order?.userId));
    const resolved = resolveExportProfile(candidates || [], customer, order?.userId);
    return resolved?.id ? byId.get(resolved.id) : undefined;
  };
}