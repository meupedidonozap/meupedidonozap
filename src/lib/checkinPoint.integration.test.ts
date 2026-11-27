import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

// Explicit opt-in: uses a minted administrator session, creates only temporary
// customers, and removes those customers and their cascading visits/audit rows.
describe.skipIf(process.env.CHECKIN_INTEGRATION !== '1')('persistência do ponto DiColore', () => {
  const client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let userId = '';
  let storeId = '';
  let customerId = '';
  const address = { address: 'Rua de teste', number: '123', neighborhood: 'Centro', city: 'Jaraguá do Sul', uf: 'SC', cep: '89251000' };

  beforeAll(async () => {
    const minted = JSON.parse(readFileSync(`${homedir()}/.cache/lovable-auth/session.json`, 'utf8'));
    await client.auth.setSession(minted.session);
    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error('Sessão de teste indisponível');
    userId = user.id;
    const { data: store } = await client.from('stores').select('id').eq('slug', 'dicolore').single();
    if (!store) throw new Error('Loja não encontrada');
    storeId = store.id;
    const { data, error } = await client.from('customer_profiles').insert({
      store_id: storeId, name: 'ZZ TESTE AUTOMATICO CHECKIN', customer_code: `TEST-CHECKIN-${Date.now()}`,
      cpf_cnpj: '52998224725', whatsapp: '47999999999', seller_code: '28', is_active: true,
      ...address, geo_lat: -26.5, geo_lng: -49.07,
    }).select('id').single();
    expect(error?.code).toBeUndefined();
    if (!data) throw new Error('Cliente temporário não criado');
    customerId = data.id;
  });

  afterAll(async () => {
    if (!customerId) return;
    const { error } = await client.from('customer_profiles').delete().eq('id', customerId);
    expect(error?.code).toBeUndefined();
  });

  async function visit(lat: number, lng: number, distance: number) {
    return client.from('customer_visits').insert({ store_id: storeId, customer_profile_id: customerId,
      seller_user_id: userId, seller_code: '28', checkin_lat: lat, checkin_lng: lng,
      distance_meters_at_checkin: distance,
    }).select('id').single();
  }

  it('bloqueia acima do raio e não grava visita nem move o ponto', async () => {
    const { error } = await visit(-26.48, -49.07, 0);
    expect(error?.code).toBe('P0001');
    const { data } = await client.from('customer_profiles').select('geo_lat,geo_lng').eq('id', customerId).single();
    expect(Number(data?.geo_lat)).toBe(-26.5);
    const { count } = await client.from('customer_visits').select('id', { count: 'exact', head: true }).eq('customer_profile_id', customerId);
    expect(count).toBe(0);
  });

  it('dentro do raio registra a visita sem mover o ponto', async () => {
    const { error } = await visit(-26.5005, -49.07, 56);
    expect(error?.code).toBeUndefined();
    const { data } = await client.from('customer_profiles').select('geo_lat,geo_lng').eq('id', customerId).single();
    expect(Number(data?.geo_lat)).toBe(-26.5);
  });

  it('cliente sem coordenada recebe a posição do check-in', async () => {
    const cleared = await client.from('customer_profiles').update({ geo_lat: null, geo_lng: null }).eq('id', customerId).select('id').single();
    expect(cleared.error?.code).toBeUndefined();
    const { error } = await visit(-26.48, -49.07, 0);
    expect(error?.code).toBeUndefined();
    const { data } = await client.from('customer_profiles').select('geo_lat,geo_lng').eq('id', customerId).single();
    expect(Number(data?.geo_lat)).toBe(-26.48);
    expect(Number(data?.geo_lng)).toBe(-49.07);
  });

  it('não altera nenhum campo do endereço vindo do ERP', async () => {
    const { data } = await client.from('customer_profiles').select('address,number,neighborhood,city,uf,cep').eq('id', customerId).single();
    expect(data).toEqual(address);
  });

  it('a próxima visita no mesmo ponto é aceita', async () => {
    const { error } = await visit(-26.48, -49.07, 0);
    expect(error?.code).toBeUndefined();
    const { data } = await client.from('customer_profiles').select('geo_lat,geo_lng').eq('id', customerId).single();
    expect(Number(data?.geo_lat)).toBe(-26.48);
    expect(Number(data?.geo_lng)).toBe(-49.07);
  });

  it('rejeita coordenada inválida sem mudar o ponto anterior', async () => {
    const { error } = await visit(91, -49.07, 0);
    expect(error?.code).toBe('P0001');
    const { data } = await client.from('customer_profiles').select('geo_lat').eq('id', customerId).single();
    expect(Number(data?.geo_lat)).toBe(-26.48);
  });
});