import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mock = vi.hoisted(() => ({
  android: vi.fn(() => true), save: vi.fn(), share: vi.fn(), success: vi.fn(), error: vi.fn(),
  boleto: vi.fn(), from: vi.fn(), createUrl: vi.fn((_file: Blob) => 'blob:boleto-test'),
}));
vi.mock('@/lib/nativeAndroid', () => ({ isDicoloreAndroid: mock.android, saveAndroidPdf: mock.save, shareAndroidPdf: mock.share }));
vi.mock('@/hooks/useDicoloreRefresh', () => ({ useDicoloreRefresh: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: mock.success, error: mock.error } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mock.from } }));

import TitlesPanel from './TitlesPanel';
import { previewOrderPdf, subscribeOrderPdf } from '@/lib/orderPdfPreview';
import { deliverOrderPdfFile } from '@/lib/shareOrderPdf';

const original = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\nBank-issued boleto\n%%EOF';
let current: File | null;
let unsubscribe: () => void;

function renderTitles() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><TitlesPanel storeId="store-test" customerCode="97169" initialFilter="ABERTO" /></QueryClientProvider>);
}

function binary(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(typeof reader.result === 'string' ? atob(reader.result.split(',')[1]) : '');
    reader.readAsDataURL(file);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mock.android.mockReturnValue(true);
  mock.boleto.mockResolvedValue({ data: { file_name: 'boleto-bancario.pdf', pdf_base64: btoa(original) }, error: null });
  mock.from.mockImplementation((table: string) => {
    const q = {
      select: vi.fn(() => q), eq: vi.fn(() => q), order: vi.fn(() => q),
      range: vi.fn(() => q),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [{ id: 'title-test', codigo: '12345', parcela: '2', data_vencimento: '2099-12-31', valor_total: 150, has_boleto: true, status: 'ABERTO' }], error: null }).then(resolve),
      maybeSingle: mock.boleto,
    };
    if (!['customer_titles', 'customer_title_boletos'].includes(table)) throw new Error(`Unexpected table: ${table}`);
    return q;
  });
  vi.stubGlobal('URL', { createObjectURL: mock.createUrl, revokeObjectURL: vi.fn() });
  previewOrderPdf(null);
  unsubscribe = subscribeOrderPdf(file => { current = file; });
});

afterEach(() => {
  cleanup(); unsubscribe(); previewOrderPdf(null); vi.unstubAllGlobals(); vi.restoreAllMocks();
});

describe('Boleto delivery from TitlesPanel', () => {
  it('opens the original bank PDF in the APK, then saves or shares the same bytes', async () => {
    renderTitles();
    fireEvent.click(await screen.findByRole('button', { name: 'Boleto' }));
    await waitFor(() => expect(current).toBeInstanceOf(File));
    if (!current) throw new Error('Preview did not receive the boleto');
    const file = current;
    expect(file.name).toBe('boleto-bancario.pdf');
    expect(file.type).toBe('application/pdf');
    expect(await binary(file)).toBe(original);
    expect(mock.createUrl).not.toHaveBeenCalled();
    expect(mock.save).not.toHaveBeenCalled();
    mock.save.mockResolvedValue(true);
    await deliverOrderPdfFile(file, 'download', true);
    expect(mock.save).toHaveBeenCalledWith(file);
    expect(mock.success).toHaveBeenCalledTimes(1);
    await deliverOrderPdfFile(file, 'share', true);
    expect(mock.share).toHaveBeenCalledWith(file);
    expect(mock.from.mock.calls.map(([table]) => table)).toEqual(['customer_titles', 'customer_title_boletos']);
  });

  it('uses title number and installment when the bank filename is absent', async () => {
    mock.boleto.mockResolvedValue({ data: { file_name: '', pdf_base64: btoa(original) }, error: null });
    renderTitles();
    fireEvent.click(await screen.findByRole('button', { name: 'Boleto' }));
    await waitFor(() => expect(current?.name).toBe('boleto-12345-2.pdf'));
  });

  it('retains browser download without calling Android or opening the preview', async () => {
    mock.android.mockReturnValue(false);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderTitles();
    fireEvent.click(await screen.findByRole('button', { name: 'Boleto' }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    const file = mock.createUrl.mock.calls[0]?.[0] as File;
    expect(await binary(file)).toBe(original);
    expect(current).toBeNull();
    expect(mock.save).not.toHaveBeenCalled();
    expect(mock.share).not.toHaveBeenCalled();
  });

  it('canceling native save preserves the open boleto without announcing success', async () => {
    renderTitles();
    fireEvent.click(await screen.findByRole('button', { name: 'Boleto' }));
    await waitFor(() => expect(current).toBeInstanceOf(File));
    if (!current) throw new Error('Preview did not receive the boleto');
    const file = current;
    mock.save.mockResolvedValue(false);
    await deliverOrderPdfFile(file, 'download', true);
    expect(current).toBe(file);
    expect(mock.success).not.toHaveBeenCalled();
  });

  it.each([
    [{ data: null, error: null }, 'Boleto não disponível para este título'],
    [{ data: null, error: { message: 'Acesso negado' } }, 'Acesso negado'],
  ])('does not deliver missing or unauthorized PDFs', async (result, message) => {
    mock.boleto.mockResolvedValue(result);
    renderTitles();
    fireEvent.click(await screen.findByRole('button', { name: 'Boleto' }));
    await waitFor(() => expect(mock.error).toHaveBeenCalledWith(message));
    expect(current).toBeNull();
    expect(mock.save).not.toHaveBeenCalled();
    expect(mock.share).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Boleto' })).toBeEnabled();
  });
});