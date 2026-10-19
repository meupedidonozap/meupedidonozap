import { describe, expect, it } from 'vitest';
import { resolveExportProfile } from '../../supabase/functions/_shared/customerExportProfile';

const erp = { id: 'erp', customer_code: '95773', cpf_cnpj: '19.620.507/0001-76', seller_code: '46', transportadora: '175', user_id: 'old-login' };
const duplicate = { id: 'duplicate', customer_code: '', cpf_cnpj: erp.cpf_cnpj, seller_code: '46', transportadora: null, user_id: 'client-login' };

describe('cadastro base da transmissão', () => {
  it('o código transmitido 95773 prevalece sobre o cadastro duplicado do login', () => {
    for (const rows of [[erp, duplicate], [duplicate, erp]]) {
      const p = resolveExportProfile(rows, { customerCode: '95773', cpfCnpj: erp.cpf_cnpj }, duplicate.user_id);
      expect(p?.customer_code).toBe('95773');
      expect(p?.seller_code).toBe('46');
      expect(p?.transportadora).toBe('175');
    }
  });
  it('pedido antigo #524 sem código recupera 95773 e transportadora 175 do cadastro ERP', () => {
    const p = resolveExportProfile([erp, duplicate], { cpfCnpj: erp.cpf_cnpj }, duplicate.user_id);
    expect(p?.customer_code).toBe('95773');
    expect(p?.transportadora).toBe('175');
  });
  it('um código explícito inexistente não pode pegar dados de outro cliente por documento ou login', () => {
    expect(resolveExportProfile([erp], { customerCode: '99999', cpfCnpj: erp.cpf_cnpj }, erp.user_id)).toBeUndefined();
  });
  it('dois códigos para o mesmo documento não podem ser escolhidos arbitrariamente sem código no pedido', () => {
    expect(resolveExportProfile([erp, { ...erp, customer_code: '12345' }], { cpfCnpj: erp.cpf_cnpj }, erp.user_id)).toBeUndefined();
  });
});