// Regra única: um pedido pertence à carteira do vendedor/televendas quando o
// cliente do pedido está cadastrado com um dos códigos de vendedor do usuário.
// Se o cliente não for encontrado no cadastro, vale o código de vendedor gravado no pedido.

export interface PortfolioProfile {
  customerCode?: string | null;
  cpfCnpj?: string | null;
  whatsapp?: string | null;
  sellerCode?: string | null;
}

const normCode = (c: unknown) => String(c ?? '').trim().replace(/^0+/, '');
const digits = (s: unknown) => String(s ?? '').replace(/\D/g, '');
const last8 = (s: unknown) => digits(s).slice(-8);

export function buildPortfolioMatcher(profiles: PortfolioProfile[], sellerCodes: string[]) {
  const sellers = new Set(sellerCodes.map(c => String(c).trim()).filter(Boolean));
  const byCode = new Map<string, string>();
  const byDoc = new Map<string, string>();
  const byPhone = new Map<string, string>();
  for (const p of profiles) {
    const sc = String(p.sellerCode || '').trim();
    if (!sc) continue;
    const cc = normCode(p.customerCode);
    if (cc) byCode.set(cc, sc);
    const d = digits(p.cpfCnpj);
    if (d) byDoc.set(d, sc);
    const w = last8(p.whatsapp);
    if (w) byPhone.set(w, sc);
  }
  return (order: any): boolean => {
    const c = order?.customer || {};
    const cc = normCode(c.customerCode ?? c.customer_code);
    let sc: string | undefined;
    if (cc) sc = byCode.get(cc);
    if (!sc && digits(c.cpfCnpj)) sc = byDoc.get(digits(c.cpfCnpj));
    if (!sc && last8(c.whatsapp)) sc = byPhone.get(last8(c.whatsapp));
    if (!sc) sc = String(c.sellerCode || '').trim() || undefined;
    return !!sc && sellers.has(sc);
  };
}
