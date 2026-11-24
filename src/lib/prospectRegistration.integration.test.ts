import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

describe.skipIf(process.env.PROSPECT_INTEGRATION !== '1')('PROSPECT: gravação autorizada DiColore', () => {
  const client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let userId = ''; let storeId = ''; let customerId = ''; let visitId = '';
  const registration = { name: 'ZZ TESTE AUTOMATICO PROSPECT', cpf_cnpj: '', customer_code: '',
    whatsapp: '47999999999', cep: '89251000', uf: 'SC', city: 'Jaraguá do Sul',
    neighborhood: 'Centro', address: 'Rua teste prospect', number: '10', seller_code: '28' };
  beforeAll(async () => {
    const minted = JSON.parse(readFileSync(`${homedir()}/.cache/lovable-auth/session.json`, 'utf8'));
    await client.auth.setSession(minted.session);
    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error('Sessão autorizada necessária');
    userId = user.id;
    const { data } = await client.from('stores').select('id').eq('slug', 'dicolore').single();
    if (!data) throw new Error('Loja não encontrada');
    storeId = data.id;
  });
  afterAll(async () => {
    if (customerId) {
      const { error } = await client.from('customer_profiles').delete().eq('id', customerId).eq('store_id', storeId);
      expect(error).toBeNull();
    }
  });
  it('cadastra cliente novo sem CPF/CNPJ', async () => {
    const { data, error } = await client.from('customer_profiles').insert({ ...registration, store_id: storeId }).select('id,cpf_cnpj,customer_code').single();
    expect(error).toBeNull();
    if (!data) throw new Error('Cadastro temporário não criado');
    customerId = data.id;
    expect(data.cpf_cnpj).toBe(''); expect(data.customer_code).toBe('');
  });
  it('registra check-in sem documento', async () => {
    const { data, error } = await client.from('customer_visits').insert({ store_id: storeId, customer_profile_id: customerId,
      seller_user_id: userId, seller_code: '28', checkin_lat: -26.48, checkin_lng: -49.07, distance_meters_at_checkin: 0,
    }).select('id').single();
    expect(error).toBeNull(); if (!data) throw new Error('Visita não criada'); visitId = data.id;
  });
  it('registra check-out sem documento', async () => {
    const { data, error } = await client.from('customer_visits').update({ checked_out_at: new Date().toISOString(),
      checkout_lat: -26.48, checkout_lng: -49.07, checkout_reason: 'Teste', duration_seconds: 1,
    }).eq('id', visitId).eq('store_id', storeId).select('checked_out_at').single();
    expect(error).toBeNull(); expect(data?.checked_out_at).toBeTruthy();
  });
  it('não aceita documento preenchido inválido', async () => {
    const { error } = await client.from('customer_profiles').update({ cpf_cnpj: '11111111111' })
      .eq('id', customerId).eq('store_id', storeId).select().single();
    expect(error?.code).toBe('23514');
  });
  it('salva dados completos e retorna os dados persistidos', async () => {
    const { data, error } = await client.from('customer_profiles').update({ cpf_cnpj: '52998224725', number: '42' })
      .eq('id', customerId).eq('store_id', storeId).select('cpf_cnpj,number').single();
    expect(error).toBeNull(); expect(data).toEqual({ cpf_cnpj: '52998224725', number: '42' });
  });
});