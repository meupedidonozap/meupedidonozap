import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ single: vi.fn(), android: vi.fn(() => false), save: vi.fn(), share: vi.fn(), preview: vi.fn(), success: vi.fn() }));
const query = { select: vi.fn(() => query), eq: vi.fn(() => query), single: mock.single };
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => query } }));
vi.mock('./nativeAndroid', () => ({ isDicoloreAndroid: mock.android, saveAndroidPdf: mock.save, shareAndroidPdf: mock.share }));
vi.mock('./orderPdfPreview', () => ({ previewOrderPdf: mock.preview }));
vi.mock('sonner', () => ({ toast: { success: mock.success } }));
import { shareOrderPdf, deliverOrderPdfFile } from './shareOrderPdf';
beforeEach(() => { vi.clearAllMocks(); mock.android.mockReturnValue(true); });

describe('PDF independent of order status', () => {
  it.each(['orcamento', 'pendente', 'liberado_transmissao', 'confirmado', 'preparando', 'enviado', 'entregue', 'cancelado'])('exports an authorized %s order without changing it', async status => {
    mock.single.mockResolvedValue({ data: { status, order_number: 1, created_at: '2026-11-25T10:34:00Z', customer: { name: 'Cliente de teste' }, items: [], total: 10 }, error: null });
    mock.save.mockResolvedValue(true);
    await shareOrderPdf('allowed-order', 'DiColore', 'download');
    expect(query.select).toHaveBeenCalledWith('*');
    expect(query.eq).toHaveBeenCalledWith('id', 'allowed-order');
    const file = mock.save.mock.calls[0]?.[0];
    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe('application/pdf');
    expect(file.size).toBeGreaterThan(500);
  });
  it('does not export an unauthorized order', async () => {
    mock.single.mockResolvedValue({ data: null, error: { message: 'Acesso negado' } });
    await expect(shareOrderPdf('not-allowed', 'DiColore', 'download')).rejects.toThrow('Acesso negado');
    expect(mock.save).not.toHaveBeenCalled();
  });
  it('opens the Android preview without relying on WebView blob navigation', async () => {
    const file = new File(['pdf'], 'p.pdf');
    await deliverOrderPdfFile(file);
    expect(mock.preview).toHaveBeenCalledWith(file);
    expect(mock.save).not.toHaveBeenCalled();
  });
  it('canceling Android save never announces success', async () => {
    mock.save.mockResolvedValue(false);
    await deliverOrderPdfFile(new File(['pdf'], 'p.pdf'), 'download');
    expect(mock.success).not.toHaveBeenCalled();
  });
  it('other stores retain their browser sharing path, even when the native bridge exists', async () => {
    mock.android.mockReturnValue(false);
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { canShare: () => true, share });
    try {
      const file = new File(['pdf'], 'p.pdf');
      await deliverOrderPdfFile(file, 'share');
      expect(share).toHaveBeenCalledWith({ files: [file], title: 'p.pdf' });
      expect(mock.share).not.toHaveBeenCalled();
      expect(mock.save).not.toHaveBeenCalled();
      expect(mock.preview).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
});