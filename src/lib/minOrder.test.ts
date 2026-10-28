import { describe, it, expect } from 'vitest';
import { effectiveMinOrder } from './minOrder';

describe('effectiveMinOrder', () => {
  it('vendedor/televendas na DiColore não têm mínimo', () => {
    expect(effectiveMinOrder({ slug: 'dicolore', settings: { minOrderValue: 300 } }, true)).toBe(0);
  });
  it('cliente na DiColore mantém o mínimo', () => {
    expect(effectiveMinOrder({ slug: 'dicolore', settings: { minOrderValue: 300 } }, false)).toBe(300);
  });
  it('outras lojas mantêm o mínimo mesmo para vendedor', () => {
    expect(effectiveMinOrder({ slug: 'dicoloresenses', settings: { minOrderValue: 200 } }, true)).toBe(200);
  });
});
