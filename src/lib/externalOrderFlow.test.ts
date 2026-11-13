import { describe, expect, it } from 'vitest';
import { resolveExternalExportProfile, usesUnifiedExternalFlow } from '../../supabase/functions/_shared/customerExportProfile';
import { toDwCliente } from '../../supabase/functions/_shared/dwCliente';

const prospect = { id: 'customer-mpz', customer_code: '', cpf_cnpj: '12345678909', name: 'Cliente', seller_code: '32', municipio_codigo_ibge: '4205407' };
describe('integração unificada externa', () => {
  it('ativa somente na DiColore com SIM e origem externa', () => {
    expect(usesUnifiedExternalFlow('dicolore', { useExternalIntegrator: true }, 'externa')).toBe(true);
    expect(usesUnifiedExternalFlow('dicolore', { useExternalIntegrator: false }, 'externa')).toBe(false);
    expect(usesUnifiedExternalFlow('dicolore', { useExternalIntegrator: true }, 'bat')).toBe(false);
    expect(usesUnifiedExternalFlow('jewos', { useExternalIntegrator: true }, 'externa')).toBe(false);
  });
  it('cliente novo tem id MPZ e código ERP vazio com dados DW', () => {
    const cp = resolveExternalExportProfile([prospect], { cpfCnpj: '123.456.789-09' });
    expect(cp?.id).toBe('customer-mpz');
    const dw = toDwCliente(cp);
    expect(dw.codigo).toBe('');
    expect(dw.vendedor_codigo).toBe('32');
    expect(dw.municipio_codigo_ibge).toBe('4205407');
  });
  it('não substitui código ERP explícito por prospect ou outro cadastro', () => {
    expect(resolveExternalExportProfile([prospect], { customerCode: '98765', cpfCnpj: prospect.cpf_cnpj })).toBeUndefined();
  });
  it('não escolhe cliente duplicado ou login do operador arbitrariamente', () => {
    expect(resolveExternalExportProfile([prospect, { ...prospect, id: 'duplicate' }], { cpfCnpj: prospect.cpf_cnpj })).toBeUndefined();
    expect(resolveExternalExportProfile([prospect], {})).toBeUndefined();
  });
  it('após cadastro recupera o código ERP pelo documento', () => {
    expect(resolveExternalExportProfile([prospect, { ...prospect, id: 'erp', customer_code: '98765' }], { cpfCnpj: prospect.cpf_cnpj })?.customer_code).toBe('98765');
  });
});