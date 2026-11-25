import { afterEach, describe, expect, it, vi } from 'vitest';

const openUrl = vi.fn();
const native = { android: true, launcher: true };
vi.mock('@capacitor/core', () => ({
  Capacitor: { isPluginAvailable: () => native.launcher, isNativePlatform: () => native.android, getPlatform: () => 'android' },
  registerPlugin: () => ({}),
}));
vi.mock('@capacitor/app-launcher', () => ({ AppLauncher: { openUrl: (o: any) => openUrl(o) } }));

import { installNativeWhatsAppLinks, openWhatsAppNative, whatsAppTarget } from './nativeWhatsApp';

afterEach(() => { openUrl.mockReset(); native.android = true; native.launcher = true; });

describe('WhatsApp no APK', () => {
  it('reconhece somente links de WhatsApp', () => {
    expect(whatsAppTarget('https://wa.me/5547999990000?text=Pedido%20%231')).toEqual({ phone: '5547999990000', text: 'Pedido #1' });
    expect(whatsAppTarget('whatsapp://send?phone=5547999990000&text=Oi')).toEqual({ phone: '5547999990000', text: 'Oi' });
    expect(whatsAppTarget('https://wa.me.evil.com/5547999990000')).toBeNull();
    expect(whatsAppTarget('https://meupedidonozap.lovable.app/dicolore')).toBeNull();
    expect(whatsAppTarget('')).toBeNull();
  });

  it('abre o aplicativo instalado com telefone e mensagem', async () => {
    openUrl.mockResolvedValue({ completed: true });
    expect(await openWhatsAppNative('https://wa.me/5547999990000?text=Pedido%20%231')).toBe(true);
    expect(openUrl).toHaveBeenCalledTimes(1);
    expect(openUrl).toHaveBeenCalledWith({ url: 'whatsapp://send?phone=5547999990000&text=Pedido%20%231' });
  });

  it('usa o link universal quando o aplicativo não responde', async () => {
    openUrl.mockResolvedValueOnce({ completed: false }).mockResolvedValueOnce({ completed: true });
    expect(await openWhatsAppNative('https://wa.me/5547999990000?text=Oi')).toBe(true);
    expect(openUrl).toHaveBeenLastCalledWith({ url: 'https://api.whatsapp.com/send?phone=5547999990000&text=Oi' });
  });

  it('avisa quando nenhuma forma abre o WhatsApp', async () => {
    openUrl.mockRejectedValue(new Error('no activity'));
    expect(await openWhatsAppNative('https://wa.me/5547999990000?text=Oi')).toBe(false);
  });

  it('não interfere fora do APK', async () => {
    native.android = false;
    expect(await openWhatsAppNative('https://wa.me/5547999990000?text=Oi')).toBe(false);
    expect(openUrl).not.toHaveBeenCalled();
  });

  it('intercepta o toque em links de WhatsApp e preserva os demais', async () => {
    openUrl.mockResolvedValue({ completed: true });
    const remove = installNativeWhatsAppLinks(() => undefined);
    document.body.innerHTML = '<a id="w" href="https://wa.me/5547999990000?text=Oi"><span>Abrir</span></a><a id="o" href="#outro">x</a>';
    const wa = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.querySelector('#w span')!.dispatchEvent(wa);
    const other = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.querySelector('#o')!.dispatchEvent(other);
    await vi.waitFor(() => expect(openUrl).toHaveBeenCalledTimes(1));
    expect(wa.defaultPrevented).toBe(true);
    expect(other.defaultPrevented).toBe(false);
    remove();
  });
});
