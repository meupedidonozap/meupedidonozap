/** ERP imports and repair share the same missing-only, store-scoped access path. */
export type AccessTarget = {
  profile_id: string;
  store_id: string;
  customer_code: string;
  existing_account_id: string | null;
};
type ApiError = { message: string; code?: string } | null;
type Client = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: ApiError }>;
  auth: { admin: { createUser(attributes: {
    email: string; password: string; email_confirm: boolean;
    user_metadata: { customer_code: string; login: string; store_id: string };
  }): PromiseLike<{ data: { user: { id: string } | null }; error: ApiError }> } };
};

export const ACCESS_BATCH_LIMIT = 100;
export function dicoloreCredentials(code: string) {
  const login = code.trim();
  if (!/^\d+$/.test(login)) throw new Error('Código ERP obrigatório');
  return {
    email: `${login}@dicolore.cliente.local`,
    password: login.length >= 6 ? login : `dico${login}`,
  };
}

export async function ensureDicoloreCustomerAccess(
  client: Client, storeSlug: string, codes?: string[],
  options: { max?: number; deadline?: number } = {},
) {
  const result = { created: 0, linked: 0, errors: [] as { codigo: string; erro: string }[] };
  if (storeSlug !== 'dicolore' || codes?.length === 0) return result;
  const selectedCodes = codes ? [...new Set(codes.map(c => c.trim()).filter(c => /^\d+$/.test(c)))] : null;
  if (selectedCodes?.length === 0) return result;
  const max = Math.max(1, Math.min(options.max ?? ACCESS_BATCH_LIMIT, ACCESS_BATCH_LIMIT));
  const { data, error } = await client.rpc('dicolore_access_targets', {
    p_codes: selectedCodes, p_limit: selectedCodes ? Math.min(selectedCodes.length, 5000) : max,
  });
  if (error) throw new Error('Não foi possível consultar acessos pendentes');
  const targets = (data ?? []) as AccessTarget[];
  const pending = (t: AccessTarget) => result.errors.push({ codigo: t.customer_code, erro: 'Acesso pendente; repetir este código' });
  const bounded = targets.slice(0, max);
  for (let start = 0; start < bounded.length; start += 5) {
    const batch = bounded.slice(start, start + 5);
    if (options.deadline && Date.now() >= options.deadline) {
      bounded.slice(start).forEach(pending);
      break;
    }
    await Promise.all(batch.map(async target => {
      try {
        let accountId = target.existing_account_id;
        if (!accountId) {
          const credentials = dicoloreCredentials(target.customer_code);
          const created = await client.auth.admin.createUser({
            ...credentials, email_confirm: true,
            user_metadata: { customer_code: target.customer_code, login: target.customer_code, store_id: target.store_id },
          });
          if (created.error) {
            // A concurrent import may have created it. Never reset its password.
            const retry = await client.rpc('dicolore_access_targets', { p_codes: [target.customer_code], p_limit: 1 });
            const rows = (retry.data ?? []) as AccessTarget[];
            if (retry.error || !rows[0]?.existing_account_id) throw new Error(`Criação do acesso não confirmada (${created.error.code ?? 'auth_error'}); repetir este código`);
            accountId = rows[0].existing_account_id;
          } else {
            accountId = created.data.user?.id ?? null;
            if (accountId) result.created++;
          }
        }
        if (!accountId) throw new Error('Conta de acesso indisponível');
        const linked = await client.rpc('link_dicolore_customer_access', {
          p_profile_id: target.profile_id, p_customer_code: target.customer_code, p_account_id: accountId,
        });
        if (linked.error || linked.data !== true) throw new Error('Vínculo do acesso não confirmado; repetir este código');
        result.linked++;
      } catch (error) {
        result.errors.push({ codigo: target.customer_code, erro: error instanceof Error ? error.message : 'Falha ao criar acesso' });
      }
    }));
  }
  targets.slice(max).forEach(pending);
  return result;
}