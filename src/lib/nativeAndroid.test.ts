import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ save: vi.fn(), available: vi.fn(() => true), native: vi.fn(() => true), platform: vi.fn(() => 'android') }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: mock.native, getPlatform: mock.platform, isPluginAvailable: mock.available }, registerPlugin: () => ({ savePdf: mock.save }) }));
import { saveAndroidPdf, fileBase64 } from './nativeAndroid';

beforeEach(() => { vi.clearAllMocks(); mock.available.mockReturnValue(true); });
describe('Android PDF destination', () => {
  it('saves the PDF bytes only through the user-selected document destination', async () => {
    mock.save.mockResolvedValue({ saved: true });
    const file = new File(['%PDF-test'], 'pedido.pdf', { type: 'application/pdf' });
    expect(await saveAndroidPdf(file)).toBe(true);
    expect(mock.save).toHaveBeenCalledWith({ filename: 'pedido.pdf', data: 'JVBERi10ZXN0' });
    expect(await fileBase64(file)).toBe('JVBERi10ZXN0');
  });
  it('canceling the destination is not a successful download', async () => {
    mock.save.mockResolvedValue({ saved: false });
    expect(await saveAndroidPdf(new File(['pdf'], 'p.pdf'))).toBe(false);
  });
  it('an older APK must not silently fall back to a WebView blob download', async () => {
    mock.available.mockReturnValue(false);
    await expect(saveAndroidPdf(new File(['pdf'], 'p.pdf'))).rejects.toThrow('nova versão do APK');
    expect(mock.save).not.toHaveBeenCalled();
  });
});