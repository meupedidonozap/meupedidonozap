// Gera o "PIX copia e cola" (BR Code estático com valor) a partir da chave PIX da loja.
// Funciona com qualquer banco/conta PJ (inclusive TON), sem API: o dinheiro cai direto na conta da loja.

export interface PixPayloadInput {
  key: string;
  name: string;
  city: string;
  amount: number;
  txid?: string;
}

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;

const clean = (text: string, max: number) =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ]/g, '').trim().toUpperCase().slice(0, max);

export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Normaliza a chave: telefone ganha +55, CPF/CNPJ fica só com dígitos, e-mail/aleatória ficam como estão. */
export function normalizePixKey(raw: string): string {
  const key = raw.trim();
  if (key.includes('@') || /^[0-9a-f-]{32,36}$/i.test(key)) return key;
  if (key.startsWith('+')) return '+' + key.replace(/\D/g, '');
  const digits = key.replace(/\D/g, '');
  if (/[()\s-]/.test(key) && (digits.length === 10 || digits.length === 11)) return '+55' + digits;
  return digits || key;
}

export function buildPixPayload({ key, name, city, amount, txid }: PixPayloadInput): string {
  const account = field('00', 'br.gov.bcb.pix') + field('01', normalizePixKey(key));
  const tx = (txid || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  const body =
    field('00', '01') +
    field('26', account) +
    field('52', '0000') +
    field('53', '986') +
    (amount > 0 ? field('54', amount.toFixed(2)) : '') +
    field('58', 'BR') +
    field('59', clean(name, 25) || 'LOJA') +
    field('60', clean(city, 15) || 'BRASIL') +
    field('62', field('05', tx)) +
    '6304';
  return body + crc16(body);
}
