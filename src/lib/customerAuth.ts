/**
 * Regras de acesso do cliente por Código/Usuário.
 * O cliente sempre usa "código = senha" (ou "usuário = senha"); quando o valor
 * tem menos de 6 caracteres, o sistema completa internamente para atender ao
 * mínimo exigido pela autenticação — isso é invisível para cliente e vendedor.
 */

export function sanitizeCustomerLogin(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function buildCustomerEmail(identity: string, slug: string): string {
  const safeSlug = (slug || 'loja').toLowerCase().replace(/[^a-z0-9]/g, '');
  const safeId = sanitizeCustomerLogin(identity);
  return `${safeId}@${safeSlug}.cliente.local`;
}

/** Senha efetiva usada no Auth a partir do valor digitado (código/usuário). */
export function buildCustomerPassword(value: string): string {
  const v = (value || '').trim();
  return v.length >= 6 ? v : `dico${v}`;
}
