/** Próximo passo ao finalizar a edição de um pedido pelo vendedor/televendas na DiColore. */
export type FinalizeStep = 'save' | 'ask-payment' | 'ask-release';

export function nextFinalizeStep(o: {
  storeSlug?: string;
  isEditing: boolean;
  sellerOrder: boolean;
  asQuote: boolean;
  formaCodigo?: string;
  condicaoCodigo?: string;
}): FinalizeStep {
  if (o.storeSlug !== 'dicolore' || !o.isEditing || !o.sellerOrder || o.asQuote) return 'save';
  const has = (v?: string) => !!String(v ?? '').trim();
  if (!has(o.formaCodigo) || !has(o.condicaoCodigo)) return 'ask-payment';
  return 'ask-release';
}
