import { describe, expect, it } from 'vitest';
import { dicoloreMenuSections, dicoloreMenuPath, isAccessQuery, type DicoloreMenuAccess } from './dicoloreMenu';

const client: DicoloreMenuAccess = { authenticated: true, loading: false, error: false, isStaff: false, canAdmin: false };
const staff: DicoloreMenuAccess = { ...client, isStaff: true };

describe('DiColore navigation permissions', () => {
  it.each(['atendimento', 'vendas', 'clientes', 'resultados'] as const)('%s is visible to staff, never to customers', section => {
    expect(dicoloreMenuSections(staff)).toContain(section);
    expect(dicoloreMenuSections(client)).not.toContain(section);
  });
  it.each(['catalogo', 'notas', 'titulos'] as const)('%s is visible to both staff and customers', section => {
    expect(dicoloreMenuSections(staff)).toContain(section);
    expect(dicoloreMenuSections(client)).toContain(section);
  });
  it('routes financial entries to the correct customer or staff scope', () => {
    expect(dicoloreMenuPath('notas', false)).toBe('/dicolore/notas-fiscais');
    expect(dicoloreMenuPath('notas', true)).toBe('/dicolore/vendedor/notas');
    expect(dicoloreMenuPath('titulos', false)).toBe('/dicolore/titulos');
    expect(dicoloreMenuPath('titulos', true)).toBe('/dicolore/vendedor/titulos');
  });
  it('never grants admin navigation just because the user is staff', () => {
    expect(dicoloreMenuSections(staff)).not.toContain('admin');
    expect(dicoloreMenuSections({ ...staff, canAdmin: true })).toContain('admin');
  });
  it.each([{ loading: true }, { error: true }])('does not treat unresolved or failed access as a customer', state => {
    expect(dicoloreMenuSections({ ...client, ...state })).toEqual([]);
  });
  it('guests receive only the catalog', () => {
    expect(dicoloreMenuSections({ ...client, authenticated: false })).toEqual(['catalogo']);
  });
  it('excludes only authorization queries from persistence, preserving carts/catalog/financial cache', () => {
    expect(isAccessQuery(['store-access', 'store', 'user', 'identity-v2'])).toBe(true);
    expect(isAccessQuery(['seller-mode', 'store', 'user'])).toBe(true);
    expect(isAccessQuery(['products', 'store'])).toBe(false);
    expect(isAccessQuery(['customer-titles', 'store'])).toBe(false);
  });
});