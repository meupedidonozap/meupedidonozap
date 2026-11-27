import { describe, expect, it } from 'vitest';
import { shouldOfferCheckin } from './checkinPrompt';

const vendedor = { salesForceOn: true, isFieldSeller: true };

describe('pergunta de check-in ao selecionar cliente', () => {
  it('vendedor que seleciona cliente cadastrado ou novo recebe a pergunta', () => {
    expect(shouldOfferCheckin({ ...vendedor, customerId: 'c1', openVisitCustomerId: null })).toBe(true);
    expect(shouldOfferCheckin({ ...vendedor, customerId: 'novo-prospect' })).toBe(true);
  });
  it('só o perfil vendedor recebe a pergunta: televendas, gerente e administrador não', () => {
    expect(shouldOfferCheckin({ salesForceOn: true, isFieldSeller: false, customerId: 'c1' })).toBe(false);
  });
  it('não pergunta em loja sem atendimento', () => {
    expect(shouldOfferCheckin({ salesForceOn: false, isFieldSeller: true, customerId: 'c1' })).toBe(false);
  });
  it('não pergunta de novo quando o check-in desse cliente já está aberto', () => {
    expect(shouldOfferCheckin({ ...vendedor, customerId: 'c1', openVisitCustomerId: 'c1' })).toBe(false);
    expect(shouldOfferCheckin({ ...vendedor, customerId: 'c2', openVisitCustomerId: 'c1' })).toBe(true);
  });
});
