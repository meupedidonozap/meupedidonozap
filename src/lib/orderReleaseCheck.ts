/** Confere se o pedido está completo antes de "Liberado p/ transmissão". */
export interface ReleaseCheckInput {
  customer?: any;
  items?: any[];
  customerCode?: string;
  sellerCode?: string;
}

export function getReleaseIssues(o: ReleaseCheckInput): string[] {
  const issues: string[] = [];
  const c = o.customer || {};
  const s = (v: unknown) => String(v ?? '').trim();
  if (!s(o.customerCode ?? c.customerCode)) issues.push('Cliente sem código do ERP');
  if (!s(c.paymentFormaCodigo)) issues.push('Falta forma de pagamento');
  if (!s(c.paymentCondicaoCodigo)) issues.push('Falta condição de pagamento');
  if (!s(o.sellerCode ?? c.sellerCode)) issues.push('Falta vendedor (código do representante)');
  const items = Array.isArray(o.items) ? o.items : [];
  if (items.length === 0) issues.push('Pedido sem itens');
  else if (items.some(it => !s(it?.code) || !(Number(it?.quantity) > 0)))
    issues.push('Há item sem código ou com quantidade zerada');
  return issues;
}
