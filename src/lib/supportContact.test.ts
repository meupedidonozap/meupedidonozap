import { describe, expect, it } from 'vitest';
import {
  buildAttendanceLink,
  DICOLORE_ATTENDANCE_MESSAGE,
  DICOLORE_ATTENDANCE_WHATSAPP,
} from './supportContact';

describe('botão "Fale com nosso atendimento"', () => {
  it('abre o WhatsApp 47 9186-5816 com a mensagem do catálogo DiColore', () => {
    const url = buildAttendanceLink('dicolore');
    expect(url).toBe(`https://wa.me/${DICOLORE_ATTENDANCE_WHATSAPP}?text=${encodeURIComponent(DICOLORE_ATTENDANCE_MESSAGE)}`);
    expect(url).toContain('wa.me/554791865816');
    expect(decodeURIComponent(url!.split('?text=')[1])).toBe(
      'Olá, gostaria de comprar produtos pelo Catálogo Digital da Dicolore, como eu faço?',
    );
  });

  it('não exibe o botão nas demais lojas', () => {
    expect(buildAttendanceLink('jewosnewborn')).toBeNull();
    expect(buildAttendanceLink('dicoloresenses')).toBeNull();
    expect(buildAttendanceLink(undefined)).toBeNull();
  });
});
