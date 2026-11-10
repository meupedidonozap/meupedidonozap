import { describe, expect, it } from 'vitest';
import { customerSchema, getCustomerError } from './customerValidation';

const complete = { name: 'Cliente Teste', cpfCnpj: '529.982.247-25', whatsapp: '(47) 99999-9999', cep: '88352-454', uf: 'SC', city: 'Brusque', neighborhood: 'Centro', address: 'Rua Teste', number: '10' };
describe('dados obrigatórios em todas as lojas', () => {
  it('exige CPF/CNPJ e valida os dígitos verificadores', () => {
    for (const cpfCnpj of ['', '11111111111', '52998224724']) expect(customerSchema.safeParse({ ...complete, cpfCnpj }).success).toBe(false);
    expect(customerSchema.safeParse({ ...complete, cpfCnpj: '11.222.333/0001-81' }).success).toBe(true);
  });
  it('exige telefone com DDD de 10 ou 11 dígitos', () => {
    for (const whatsapp of ['', '999999999', '479999999999']) expect(customerSchema.safeParse({ ...complete, whatsapp }).success).toBe(false);
    expect(customerSchema.safeParse({ ...complete, whatsapp: '4733334444' }).success).toBe(true);
  });
  it.each(['cep', 'uf', 'city', 'neighborhood', 'address', 'number'])('exige endereço completo: %s inclusive em retirada', field => {
    expect(customerSchema.safeParse({ ...complete, [field]: '  ' }).success).toBe(false);
  });
  it('aceita dados completos sem complemento e número S/N', () => {
    expect(customerSchema.safeParse(complete).success).toBe(true);
    expect(customerSchema.safeParse({ ...complete, number: 'S/N' }).success).toBe(true);
  });
});
describe('retirada na loja', () => {
  const base = { name: 'Maria', cpfCnpj: '529.982.247-25', whatsapp: '11987654321' };
  it('não exige CEP nem endereço na retirada', () => {
    expect(getCustomerError({ ...base, cep: '', uf: '', city: '', neighborhood: 'RETIRAR NA LOJA', address: 'RETIRAR NA LOJA', number: '' })).toBeNull();
  });
  it('ainda exige CPF/CNPJ válido na retirada', () => {
    expect(getCustomerError({ ...base, cpfCnpj: '111.111.111-11' }, { pickup: true })).toBe('Informe um CPF/CNPJ válido.');
  });
  it('entrega continua exigindo CEP', () => {
    expect(getCustomerError({ ...base, cep: '' })).toBe('Informe um CEP com 8 dígitos.');
  });
});
