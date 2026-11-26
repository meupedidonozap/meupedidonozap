import { describe, expect, it } from 'vitest';
import { shouldOfferCheckin } from './checkinPrompt';

describe('pergunta de check-in ao selecionar cliente', () => {
  it('vendedor que seleciona cliente cadastrado ou novo recebe a pergunta', () => {
    expect(shouldOfferCheckin({ salesForceOn: true, customerId: 'c1', openVisitCustomerId: null })).toBe(true);
    expect(shouldOfferCheckin({ salesForceOn: true, customerId: 'novo-prospect' })).toBe(true);
  });
  it('não pergunta fora do perfil vendedor da loja com atendimento', () => {
    expect(shouldOfferCheckin({ salesForceOn: false, customerId: 'c1' })).toBe(false);
  });
  it('não pergunta de novo quando o check-in desse cliente já está aberto', () => {
    expect(shouldOfferCheckin({ salesForceOn: true, customerId: 'c1', openVisitCustomerId: 'c1' })).toBe(false);
    expect(shouldOfferCheckin({ salesForceOn: true, customerId: 'c2', openVisitCustomerId: 'c1' })).toBe(true);
  });
});
