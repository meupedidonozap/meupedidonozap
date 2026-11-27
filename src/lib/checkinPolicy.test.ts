import { describe, expect, it } from 'vitest';
import { checkinDecision, checkinDistance, checkinPolicy, formatDistance } from './checkinPolicy';

const saved = { lat: -26.48, lng: -49.07 };

describe('check-in DiColore', () => {
  it('fixa o ponto apenas na DiColore', () => {
    expect(checkinPolicy('dicolore').fixesPoint).toBe(true);
    expect(checkinPolicy('jewos').fixesPoint).toBe(false);
    expect(checkinPolicy('senses').fixesPoint).toBe(false);
  });
  it('a volta ao último ponto tem distância zero', () => {
    expect(checkinDistance(saved, saved)).toBe(0);
  });
  it('cliente sem coordenada pede confirmação antes de gravar o ponto', () => {
    expect(checkinDecision(saved, null, 300)).toEqual({ kind: 'confirm-first-point' });
  });
  it('cliente com coordenada dentro de 300 m é liberado', () => {
    // 0,002 grau de latitude ≈ 222 m
    const decision = checkinDecision({ lat: -26.482, lng: -49.07 }, saved, 300);
    expect(decision.kind).toBe('allowed');
  });
  it('cliente com coordenada acima de 300 m é bloqueado', () => {
    // 0,003 grau de latitude ≈ 334 m
    const decision = checkinDecision({ lat: -26.483, lng: -49.07 }, saved, 300);
    expect(decision.kind).toBe('blocked');
    expect(decision.kind === 'blocked' && Math.round(decision.distance)).toBe(334);
  });
  it('o limite segue o valor configurado na loja', () => {
    expect(checkinDecision({ lat: -26.483, lng: -49.07 }, saved, 500).kind).toBe('allowed');
  });
  it('mostra a distância em metros ou quilômetros', () => {
    expect(formatDistance(334.4)).toBe('334 m');
    expect(formatDistance(38200)).toBe('38.2 km');
  });
});
