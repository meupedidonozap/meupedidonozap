import { describe, it, expect } from 'vitest';
import { locateClient, type GeoCustomer } from './clientMap';
const customer: GeoCustomer = { code: '1', name: 'Cliente', city: 'Florianópolis', uf: 'SC', seller: '4', active: true, neighborhood: 'Centro', municipality: '', lat: null, lng: null };
describe('Localização SC sem inventar endereço', () => {
  it('mantém coordenadas cadastradas', () => expect(locateClient({ ...customer, lat: -27.59, lng: -48.55 })).toEqual({ lat: -27.59, lng: -48.55, precision: 'Coordenada cadastrada' }));
  it('identifica aproximação municipal e aceita nome sem acento', () => expect(locateClient({ ...customer, city: 'florianopolis' })).toMatchObject({ precision: 'Referência municipal aproximada', lat: -27.5945 }));
  it('não posiciona cliente de outro estado', () => expect(locateClient({ ...customer, uf: 'PR' })).toBeNull());
  it('não inventa localização quando cidade não existe', () => expect(locateClient({ ...customer, city: 'Não identificada' })).toBeNull());
  it('rejeita coordenadas fora de SC e usa município IBGE', () => expect(locateClient({ ...customer, city: '', municipality: '4205407', lat: 0, lng: 0 })).toMatchObject({ precision: 'Referência municipal aproximada', lat: -27.5945 }));
});