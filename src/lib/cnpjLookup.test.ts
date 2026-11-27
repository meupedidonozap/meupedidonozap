import { describe, it, expect } from 'vitest';
import { parseCnpjWs } from './cnpjLookup';

describe('parseCnpjWs', () => {
  it('usa a IE ativa da UF do estabelecimento', () => {
    const r = parseCnpjWs({ razao_social: 'acme', estabelecimento: {
      estado: { sigla: 'SC' }, cidade: { nome: 'Blumenau' }, cep: '89010000', bairro: 'Centro',
      tipo_logradouro: 'RUA', logradouro: 'XV', numero: '10',
      inscricoes_estaduais: [{ inscricao_estadual: '111', ativo: true, estado: { sigla: 'PR' } }, { inscricao_estadual: '254194893', ativo: true, estado: { sigla: 'SC' } }],
    } });
    expect(r).toMatchObject({ name: 'ACME', ie: '254194893', uf: 'SC', city: 'Blumenau', address: 'RUA XV', number: '10' });
  });
  it('sem IE ativa, usa a IE da UF do estabelecimento mesmo marcada como inativa', () => {
    const r = parseCnpjWs({ estabelecimento: { estado: { sigla: 'SC' }, inscricoes_estaduais: [{ inscricao_estadual: '258278501', ativo: false, estado: { sigla: 'SC' } }] } });
    expect(r.ie).toBe('258278501');
  });
  it('ignora IE inativa de outra UF', () => {
    const r = parseCnpjWs({ estabelecimento: { estado: { sigla: 'SC' }, inscricoes_estaduais: [{ inscricao_estadual: '9', ativo: false, estado: { sigla: 'PR' } }] } });
    expect(r.ie).toBe('');
  });
  it('prefere a IE ativa à inativa da mesma UF', () => {
    const r = parseCnpjWs({ estabelecimento: { estado: { sigla: 'SC' }, inscricoes_estaduais: [{ inscricao_estadual: '1', ativo: false, estado: { sigla: 'SC' } }, { inscricao_estadual: '2', ativo: true, estado: { sigla: 'SC' } }] } });
    expect(r.ie).toBe('2');
  });
});
