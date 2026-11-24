import { describe, it, expect, vi } from 'vitest';
import { dicoloreCredentials, ensureDicoloreCustomerAccess, type AccessTarget } from '../../supabase/functions/_shared/dicoloreCustomerAccess';
import { buildCustomerEmail, buildCustomerPassword } from './customerAuth';

const target = (code = '98823', account: string | null = null): AccessTarget => ({
  profile_id: `profile-${code}`, store_id: 'dicolore-store', customer_code: code, existing_account_id: account,
});
function fake(initial: AccessTarget[]) {
  let targets = [...initial];
  const createUser = vi.fn(async () => ({ data: { user: { id: 'new-account' } }, error: null }));
  const rpc = vi.fn(async (name: string, _args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }> => {
    if (name === 'dicolore_access_targets') return { data: targets, error: null };
    targets = [];
    return { data: true, error: null };
  });
  return { rpc, auth: { admin: { createUser } } };
}

describe('DiColore automatic ERP customer access', () => {
  it('uses ERP code 98823 as login and the existing invisible short-password rule', () => {
    const credentials = dicoloreCredentials('98823');
    expect(credentials.email).toBe('98823@dicolore.cliente.local');
    expect(credentials.password).toBe('dico98823');
    expect(credentials.email).toBe(buildCustomerEmail('98823', 'dicolore'));
    expect(credentials.password).toBe(buildCustomerPassword('98823'));
  });
  it('retains the complete code for codes with six or more digits', () => {
    expect(dicoloreCredentials('123456').password).toBe('123456');
  });
  it.each(['', 'PROSPECT', 'DW-123'])('does not grant code access to prospect %s', value => {
    expect(() => dicoloreCredentials(value)).toThrow('Código ERP obrigatório');
  });
  it('provisions and confirms an exact official profile link after ERP import', async () => {
    const client = fake([target()]);
    const result = await ensureDicoloreCustomerAccess(client, 'dicolore', ['98823']);
    expect(result).toEqual({ created: 1, linked: 1, errors: [] });
    expect(client.auth.admin.createUser).toHaveBeenCalledWith({
      ...dicoloreCredentials('98823'), email_confirm: true,
      user_metadata: { customer_code: '98823', login: '98823', store_id: 'dicolore-store' },
    });
    expect(client.rpc).toHaveBeenCalledWith('link_dicolore_customer_access', {
      p_profile_id: 'profile-98823', p_customer_code: '98823', p_account_id: 'new-account',
    });
  });
  it('only reads received ERP codes, without a full portfolio or auth scan', async () => {
    const client = fake([]);
    await ensureDicoloreCustomerAccess(client, 'dicolore', ['98823', ' 98823 ', 'PROSPECT']);
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith('dicolore_access_targets', { p_codes: ['98823'], p_limit: 1 });
  });
  it('links an already-created account without changing its password', async () => {
    const client = fake([target('95759', 'existing-account')]);
    const result = await ensureDicoloreCustomerAccess(client, 'dicolore', ['95759']);
    expect(result).toEqual({ created: 0, linked: 1, errors: [] });
    expect(client.auth.admin.createUser).not.toHaveBeenCalled();
  });
  it('is idempotent and never reprovisions an already-linked customer', async () => {
    const client = fake([target()]);
    await ensureDicoloreCustomerAccess(client, 'dicolore', ['98823']);
    expect(await ensureDicoloreCustomerAccess(client, 'dicolore', ['98823'])).toEqual({ created: 0, linked: 0, errors: [] });
    expect(client.auth.admin.createUser).toHaveBeenCalledTimes(1);
  });
  it.each(['jewos', 'dicoloresenses', 'other-store'])('does not change access behavior for %s', async store => {
    const client = fake([target()]);
    expect(await ensureDicoloreCustomerAccess(client, store, ['98823'])).toEqual({ created: 0, linked: 0, errors: [] });
    expect(client.rpc).not.toHaveBeenCalled();
    expect(client.auth.admin.createUser).not.toHaveBeenCalled();
  });
  it('returns every unconfirmed code for retry instead of checkpointing the import', async () => {
    const client = fake([target()]);
    client.rpc.mockImplementation(async name => name === 'dicolore_access_targets'
      ? { data: [target()], error: null } : { data: false, error: null });
    const result = await ensureDicoloreCustomerAccess(client, 'dicolore', ['98823']);
    expect(result.linked).toBe(0);
    expect(result.errors.map(e => e.codigo)).toEqual(['98823']);
  });
  it('bounds a heavy reload and returns remaining codes to the existing monitor', async () => {
    const client = fake([target('99301'), target('99303'), target('99306')]);
    const result = await ensureDicoloreCustomerAccess(client, 'dicolore', ['99301', '99303', '99306'], { max: 1 });
    expect(result.linked).toBe(1);
    expect(result.errors.map(e => e.codigo)).toEqual(['99303', '99306']);
    expect(client.auth.admin.createUser).toHaveBeenCalledTimes(1);
  });
  it('returns pending codes if the execution budget expires', async () => {
    const client = fake([target()]);
    const result = await ensureDicoloreCustomerAccess(client, 'dicolore', ['98823'], { deadline: Date.now() - 1 });
    expect(result.errors.map(e => e.codigo)).toEqual(['98823']);
    expect(client.auth.admin.createUser).not.toHaveBeenCalled();
  });
  it('recovers a concurrent creation without any password rewrite', async () => {
    const concurrent = {
      rpc: vi.fn().mockResolvedValueOnce({ data: [target()], error: null })
        .mockResolvedValueOnce({ data: [target('98823', 'concurrent-account')], error: null })
        .mockResolvedValueOnce({ data: true, error: null }),
      auth: { admin: { createUser: vi.fn(async () => ({ data: { user: null }, error: { message: 'Account already exists' } })) } },
    };
    expect(await ensureDicoloreCustomerAccess(concurrent, 'dicolore', ['98823'])).toEqual({ created: 0, linked: 1, errors: [] });
    expect(concurrent.rpc).toHaveBeenLastCalledWith('link_dicolore_customer_access', {
      p_profile_id: 'profile-98823', p_customer_code: '98823', p_account_id: 'concurrent-account',
    });
  });
});