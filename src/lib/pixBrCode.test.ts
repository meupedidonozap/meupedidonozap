import { describe, it, expect } from 'vitest';
import { buildPixPayload, crc16, normalizePixKey } from './pixBrCode';

describe('PIX copia e cola', () => {
  it('CRC16 padrão do Banco Central', () => {
    expect(crc16('123456789')).toBe('29B1');
  });
  it('inclui o valor exato do pedido', () => {
    const p = buildPixPayload({ key: '12345678000199', name: 'Jewos', city: 'Blumenau', amount: 29.9, txid: 'PED123' });
    expect(p).toContain('540529.90');
    expect(p).toContain('0114' + '12345678000199');
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
  });
  it('telefone com máscara vira +55', () => {
    expect(normalizePixKey('(47) 99210-1332')).toBe('+5547992101332');
  });
});
