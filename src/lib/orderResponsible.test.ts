import { describe, expect, it } from 'vitest';
import { canManageOrderResponsible, canChangeOrderResponsible, canUnlinkOrderResponsible } from './orderResponsible';

describe('DiColore: gestão do responsável pelo pedido', () => {
  it('admin tem permissão', () => {
    expect(canManageOrderResponsible('dicolore', { isAdmin: true })).toBe(true);
  });
  it('gerente tem permissão', () => {
    expect(canManageOrderResponsible('dicolore', { isManager: true })).toBe(true);
  });
  it('vendedor e televendas não recebem a permissão', () => {
    expect(canManageOrderResponsible('dicolore', { isAdmin: false, isManager: false })).toBe(false);
  });
  it('não altera as permissões de outras lojas', () => {
    expect(canManageOrderResponsible('jewos', { isAdmin: true })).toBe(false);
    expect(canManageOrderResponsible('dicoloresenses', { isManager: true })).toBe(false);
  });
  it('não habilita antes de carregar a permissão', () => {
    expect(canManageOrderResponsible('dicolore', { isAdmin: true, loading: true })).toBe(false);
  });
  it('preserva o bloqueio de pedidos transmitidos', () => {
    expect(canChangeOrderResponsible({ status: 'pendente' })).toBe(true);
    expect(canChangeOrderResponsible({ status: 'orcamento' })).toBe(true);
    expect(canChangeOrderResponsible({ status: 'liberado_transmissao' })).toBe(false);
    expect(canChangeOrderResponsible({ status: 'pendente', xmlDownloadedAt: '2026-11-23' })).toBe(false);
    expect(canChangeOrderResponsible({ status: 'pendente', erpSentAt: '2026-11-23' })).toBe(false);
    expect(canChangeOrderResponsible({ status: 'pendente', erpOrderCode: '904' })).toBe(false);
  });
  it('desvincula pedido do cliente para que possa ser assumido novamente', () => {
    expect(canUnlinkOrderResponsible({ origem: 'web', customer: { createdByRole: 'cliente', claimedRole: 'vendedor', claimedName: 'José Carlos Rep' } })).toBe(true);
    expect(canUnlinkOrderResponsible({ origem: 'vendedor', customer: { createdByRole: 'vendedor' } })).toBe(false);
  });
});