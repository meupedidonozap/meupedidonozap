import { describe, expect, it } from 'vitest';
import { checkinDistance, checkinPolicy } from './checkinPolicy';

describe('check-in DiColore', () => {
  it('fixa o ponto apenas na DiColore', () => {
    expect(checkinPolicy('dicolore').fixesPoint).toBe(true);
    expect(checkinPolicy('jewos').fixesPoint).toBe(false);
    expect(checkinPolicy('senses').fixesPoint).toBe(false);
  });
  it('a volta ao último ponto tem distância zero', () => {
    expect(checkinDistance({ lat: -26.48, lng: -49.07 }, { lat: -26.48, lng: -49.07 })).toBe(0);
  });
  it('sem referência o primeiro check-in pode ser registrado', () => {
    expect(checkinDistance({ lat: -26.48, lng: -49.07 }, null)).toBe(0);
  });
  it('detecta fora do raio configurado de 300 metros', () => {
    expect(checkinDistance({ lat: -26.49, lng: -49.07 }, { lat: -26.48, lng: -49.07 })).toBeGreaterThan(checkinPolicy('dicolore', 300).radius);
  });
});