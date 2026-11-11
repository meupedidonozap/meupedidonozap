/** Próximo passo ao finalizar um pedido pelo vendedor/televendas na DiColore. */
export type FinalizeStep = 'save' | 'ask-payment' | 'ask-release';

/** Finalizar nunca libera implicitamente: a equipe faz uma ação separada. */
export function initialCheckoutStatus(asQuote: boolean): 'orcamento' | 'pendente' {
  return asQuote ? 'orcamento' : 'pendente';
}

export function nextFinalizeStep(o: {
  storeSlug?: string;
  isEditing: boolean;
  sellerOrder: boolean;
  asQuote: boolean;
  formaCodigo?: string;
  condicaoCodigo?: string;
}): FinalizeStep {
  if (o.storeSlug !== 'dicolore' || !o.sellerOrder || o.asQuote) return 'save';
  const has = (v?: string) => !!String(v ?? '').trim();
  if (!has(o.formaCodigo) || !has(o.condicaoCodigo)) return 'ask-payment';
  return 'ask-release';
}
