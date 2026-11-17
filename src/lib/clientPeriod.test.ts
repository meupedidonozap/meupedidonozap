import { expect, it } from 'vitest';
import { clientPeriodBounds, DEFAULT_CLIENT_PERIOD } from './clientPeriod';
it('abre Clientes com os últimos 60 dias incluindo hoje', () => {
  expect(DEFAULT_CLIENT_PERIOD).toBe('60d');
  expect(clientPeriodBounds(DEFAULT_CLIENT_PERIOD, '2026-11-16')).toEqual({ from: '2026-09-18', to: '2026-11-16' });
});