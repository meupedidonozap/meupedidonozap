import { describe, expect, it } from 'vitest';
import { getSuperfreteCustomerError } from './superfreteCustomer';

describe('getSuperfreteCustomerError', () => {
  it('exige CPF/CNPJ de 11 ou 14 dígitos para frete Super Frete', () => {
    expect(getSuperfreteCustomerError({ cpfCnpj: '', whatsapp: '(47) 99999-9999' }, 'SF-1'))
      .toBe('Informe o CPF/CNPJ do cliente (11 ou 14 dígitos) para gerar a etiqueta do Super Frete.');
    expect(getSuperfreteCustomerError({ cpfCnpj: '123.456.789-01', whatsapp: '(47) 99999-9999' }, 'SF-1')).toBeNull();
    expect(getSuperfreteCustomerError({ cpfCnpj: '12.345.678/0001-90', whatsapp: '(47) 99999-9999' }, 'SF-2')).toBeNull();
  });

  it('exige telefone com DDD de 10 ou 11 dígitos para frete Super Frete', () => {
    expect(getSuperfreteCustomerError({ cpfCnpj: '123.456.789-01', whatsapp: '9999' }, 'SF-1'))
      .toBe('Informe um WhatsApp com DDD (10 ou 11 dígitos) para gerar a etiqueta do Super Frete.');
    expect(getSuperfreteCustomerError({ cpfCnpj: '123.456.789-01', whatsapp: '(47) 3333-3333' }, 'SF-1')).toBeNull();
  });

  it('não bloqueia o frete regional de contingência', () => {
    expect(getSuperfreteCustomerError({ cpfCnpj: '', whatsapp: '' }, '04510')).toBeNull();
  });
});
