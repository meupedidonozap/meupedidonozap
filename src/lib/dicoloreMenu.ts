export type DicoloreMenuSection = 'atendimento' | 'vendas' | 'clientes' | 'resultados' | 'catalogo' | 'pedidos' | 'notas' | 'titulos' | 'admin';

export interface DicoloreMenuAccess {
  authenticated: boolean;
  loading: boolean;
  error: boolean;
  isStaff: boolean;
  canAdmin: boolean;
}

/** Navigation only: actual data/action authorization stays on the server. */
export function dicoloreMenuSections(access: DicoloreMenuAccess): DicoloreMenuSection[] {
  if (access.loading || access.error) return [];
  if (!access.authenticated) return ['catalogo'];
  const sections: DicoloreMenuSection[] = access.isStaff
    ? ['atendimento', 'vendas', 'clientes', 'resultados', 'catalogo', 'notas', 'titulos']
    : ['catalogo', 'pedidos', 'notas', 'titulos'];
  if (access.canAdmin) sections.push('admin');
  return sections;
}

export function dicoloreMenuPath(section: DicoloreMenuSection, isStaff: boolean): string {
  if (section === 'catalogo') return '/dicolore';
  if (section === 'admin') return '/dicolore/admin';
  if (section === 'pedidos') return '/dicolore/pedidos';
  if (!isStaff && section === 'notas') return '/dicolore/notas-fiscais';
  if (!isStaff && section === 'titulos') return '/dicolore/titulos';
  return `/dicolore/vendedor/${section}`;
}

/** Persisted authorization must never decide the current user's navigation. */
export function isAccessQuery(key: readonly unknown[]) {
  return key[0] === 'store-access' || key[0] === 'seller-mode';
}