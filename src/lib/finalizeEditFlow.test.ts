import { describe, it, expect } from 'vitest';
import { nextFinalizeStep } from './finalizeEditFlow';

const base = { storeSlug: 'dicolore', isEditing: true, sellerOrder: true, asQuote: false, formaCodigo: '1', condicaoCodigo: '2' };

describe('nextFinalizeStep', () => {
  it('pergunta pagamento quando falta condição', () => {
    expect(nextFinalizeStep({ ...base, condicaoCodigo: '' })).toBe('ask-payment');
  });
  it('pergunta pagamento quando falta forma', () => {
    expect(nextFinalizeStep({ ...base, formaCodigo: '' })).toBe('ask-payment');
  });
  it('pergunta liberação quando pagamento completo', () => {
    expect(nextFinalizeStep(base)).toBe('ask-release');
  });
  it('outra loja salva direto', () => {
    expect(nextFinalizeStep({ ...base, storeSlug: 'dicoloresenses', formaCodigo: '' })).toBe('save');
  });
  it('orçamento salva direto', () => {
    expect(nextFinalizeStep({ ...base, asQuote: true, formaCodigo: '' })).toBe('save');
  });
});
