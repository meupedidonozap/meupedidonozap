import { describe, expect, it, vi } from 'vitest';
import { locationFromIbge, resolveCustomerLocation } from '../../supabase/functions/_shared/customerLocation';
import { mapProfile } from '@/hooks/useCustomerProfile';

describe('DiColore ERP address', () => {
  it('translates municipality 4208906 into Jaraguá do Sul / SC', () => {
    expect(locationFromIbge({ municipio_codigo_ibge: 4208906, estado_codigo_ibge: 42 })).toEqual({ city: 'Jaraguá do Sul', uf: 'SC' });
  });
  it('preserves explicit ERP city and state', () => {
    expect(locationFromIbge({ city: 'Joinville', uf: 'SC', municipio_codigo_ibge: 4208905 })).toEqual({ city: 'Joinville', uf: 'SC' });
  });
  it('resolves legacy customer CEP without replacing street or identity', async () => {
    const mock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ localidade: 'Jaraguá do Sul', uf: 'SC' })));
    expect(await resolveCustomerLocation({ cep: '89265500' })).toEqual({ city: 'Jaraguá do Sul', uf: 'SC' });
    mock.mockRestore();
  });
  it('loads customer 83658 ERP payment defaults 4 and 58', () => {
    const profile = mapProfile({ id: '83658', forma_pagamento_codigo: '4', condicao_pagamento_codigo: '58' });
    expect(profile.paymentFormaCodigo).toBe('4');
    expect(profile.paymentCondicaoCodigo).toBe('58');
  });
});