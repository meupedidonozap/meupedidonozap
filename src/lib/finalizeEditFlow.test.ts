import { describe, it, expect } from 'vitest';
import { nextFinalizeStep, initialCheckoutStatus } from './finalizeEditFlow';

const base = { storeSlug: 'dicolore', isEditing: true, sellerOrder: true, asQuote: false, formaCodigo: '1', condicaoCodigo: '2' };

describe('nextFinalizeStep', () => {
  it('finalização cria pedido pendente para análise, nunca liberado', () => {
    expect(initialCheckoutStatus(false)).toBe('pendente');
  });
  it('salvar orçamento preserva o status de orçamento', () => {
    expect(initialCheckoutStatus(true)).toBe('orcamento');
  });
  it('pergunta pagamento quando falta condição', () => {
    expect(nextFinalizeStep({ ...base, condicaoCodigo: '' })).toBe('ask-payment');
  });
  it('pergunta pagamento quando falta forma', () => {
    expect(nextFinalizeStep({ ...base, formaCodigo: '' })).toBe('ask-payment');
  });
  it('pergunta liberação quando pagamento completo', () => {
    expect(nextFinalizeStep(base)).toBe('ask-release');
  });
  it('oferece liberação na primeira finalização do vendedor/televendas', () => {
    expect(nextFinalizeStep({ ...base, isEditing: false, formaCodigo: '4', condicaoCodigo: '71' })).toBe('ask-release');
  });
  it('cliente finaliza sem oferta de liberação, inclusive ao editar', () => {
    expect(nextFinalizeStep({ ...base, sellerOrder: false })).toBe('save');
    expect(nextFinalizeStep({ ...base, sellerOrder: false, isEditing: false })).toBe('save');
  });
  it('outra loja salva direto', () => {
    expect(nextFinalizeStep({ ...base, storeSlug: 'dicoloresenses', formaCodigo: '' })).toBe('save');
  });
  it('orçamento salva direto', () => {
    expect(nextFinalizeStep({ ...base, asQuote: true, formaCodigo: '' })).toBe('save');
  });
});
