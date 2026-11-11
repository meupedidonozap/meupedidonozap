/** Confere se o pedido está completo antes de "Liberado p/ transmissão". */
export interface ReleaseCheckInput {
  customer?: any;
  items?: any[];
  customerCode?: string;
  sellerCode?: string;
  requirePayment?: boolean;
}

export const PROSPECT_DOC_ISSUE = 'Cliente PROSPECT sem CPF/CNPJ';

export function isValidDoc(v: unknown): boolean {
  const d = String(v ?? '').replace(/\D/g, '');
  return d.length === 11 || d.length === 14;
}

/** Cliente ainda não integrado ao ERP (sem código). */
export function isProspect(code: unknown): boolean {
  return !String(code ?? '').trim();
}

export function getReleaseIssues(o: ReleaseCheckInput): string[] {
  const issues: string[] = [];
  const c = o.customer || {};
  const s = (v: unknown) => String(v ?? '').trim();
  // Cliente sem código do ERP é PROSPECT: pode ser liberado com CPF/CNPJ válido;
  // o admin integra o cadastro ao ERP antes da transmissão.
  if (!s(o.customerCode ?? c.customerCode) && !isValidDoc(c.cpfCnpj)) issues.push(PROSPECT_DOC_ISSUE);
  if (o.requirePayment !== false) {
    if (!s(c.paymentFormaCodigo)) issues.push('Falta forma de pagamento');
    if (!s(c.paymentCondicaoCodigo)) issues.push('Falta condição de pagamento');
  }
  if (!s(o.sellerCode ?? c.sellerCode)) issues.push('Falta vendedor (código do representante)');
  const items = Array.isArray(o.items) ? o.items : [];
  if (items.length === 0) issues.push('Pedido sem itens');
  else if (items.some(it => !s(it?.code) || !(Number(it?.quantity) > 0)))
    issues.push('Há item sem código ou com quantidade zerada');
  return issues;
}
