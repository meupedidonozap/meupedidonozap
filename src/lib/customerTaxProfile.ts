/**
 * Perfil fiscal do cliente para o vendedor: pessoa jurídica com Inscrição Estadual válida
 * recebe destaque nas telas de cliente, porque ajuda no fechamento da venda.
 */
export interface TaxProfileInput { cpfCnpj?: string | null; ie?: string | null; fisicaJuridica?: string | null }

export function customerTaxProfile(c: TaxProfileInput) {
  const doc = String(c.cpfCnpj ?? '').replace(/\D/g, '');
  const flag = String(c.fisicaJuridica ?? '').trim().toUpperCase();
  const person: 'PJ' | 'PF' | '' = doc.length === 14 ? 'PJ' : doc.length === 11 ? 'PF'
    : flag.startsWith('J') ? 'PJ' : flag.startsWith('F') ? 'PF' : '';
  const ie = String(c.ie ?? '').trim();
  const hasIe = /[1-9]/.test(ie) && !/^isent/i.test(ie);
  return { person, ie, hasIe, highlight: person === 'PJ' && hasIe };
}
