import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { dehydrate, hydrate, QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { useDicoloreQuery, useDicoloreRemoteTerm } from '@/hooks/useDicoloreQuery';
import { useState } from 'react';
import { REPORT_FAMILIES, scopedReportKey, type DicoloreReport } from '@/lib/dicoloreReportCache';
import DicoloreReportBoundary from './DicoloreReportBoundary';

const mock = vi.hoisted(() => ({ access: { user: { id: 'seller-A' }, isAdmin: false, role: 'vendedor', staffSellerCodes: ['46'], erpCode: '', permissions: { can_view_orders: true }, loading: false, accessError: null } }));
vi.mock('@/hooks/useStores', () => ({ useStoreBySlug: () => ({ data: { id: 'store-A', slug: 'dicolore' } }) }));
vi.mock('@/hooks/useStoreAdmin', () => ({ useStoreAdmin: () => mock.access }));

const clients: QueryClient[] = [];
const scope = () => JSON.stringify([mock.access.user?.id, mock.access.isAdmin, mock.access.role, [...mock.access.staffSellerCodes].sort(), mock.access.erpCode, mock.access.permissions]);
const keyFor = (report: DicoloreReport) => [REPORT_FAMILIES[report][0], 'store-A'];
function setup(report: DicoloreReport, saved = false, path?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  const reads = Object.fromEntries((Object.keys(REPORT_FAMILIES) as DicoloreReport[]).map(r => [r, vi.fn().mockResolvedValue(`novo-${r}`)])) as Record<DicoloreReport, ReturnType<typeof vi.fn>>;
  if (saved) client.setQueryData(scopedReportKey(keyFor(report), scope()), `salvo-${report}`, { updatedAt: Date.now() - 86400000 });
  function Reports() {
    const navigate = useNavigate();
    const orders = useDicoloreQuery({ queryKey: keyFor('pedidos'), queryFn: reads.pedidos });
    const invoices = useDicoloreQuery({ queryKey: keyFor('notas'), queryFn: reads.notas });
    const titles = useDicoloreQuery({ queryKey: keyFor('titulos'), queryFn: reads.titulos });
    const results = useDicoloreQuery({ queryKey: keyFor('resultados'), queryFn: reads.resultados });
    return <><output>{[orders.data, invoices.data, titles.data, results.data].filter(Boolean).join('|')}</output>
      <button onClick={() => navigate('/dicolore')}>catálogo</button><button onClick={() => navigate(`/dicolore/vendedor/${report === 'pedidos' ? 'vendas' : report}`)}>relatório</button></>;
  }
  const view = render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path ?? `/dicolore/vendedor/${report === 'pedidos' ? 'vendas' : report}`]}><DicoloreReportBoundary><Reports /></DicoloreReportBoundary></MemoryRouter></QueryClientProvider>);
  return { ...view, client, reads };
}

beforeEach(() => {
  mock.access = { user: { id: 'seller-A' }, isAdmin: false, role: 'vendedor', staffSellerCodes: ['46'], erpCode: '', permissions: { can_view_orders: true }, loading: false, accessError: null };
  onlineManager.setOnline(true); focusManager.setFocused(true);
});
afterEach(() => { cleanup(); clients.forEach(c => c.clear()); clients.length = 0; vi.restoreAllMocks(); onlineManager.setOnline(true); focusManager.setFocused(undefined); });

describe('DiColore report entry confirmation', () => {
  it.each<DicoloreReport>(['pedidos', 'notas', 'titulos', 'resultados'])('uses persisted %s without a request when the user declines', async report => {
    const { reads } = setup(report, true);
    fireEvent.click(await screen.findByRole('button', { name: 'Não, usar dados salvos' }));
    expect(screen.getByRole('status').textContent).toContain(`salvo-${report}`);
    await act(async () => { focusManager.setFocused(false); focusManager.setFocused(true); onlineManager.setOnline(false); onlineManager.setOnline(true); });
    expect(reads[report]).not.toHaveBeenCalled();
  });

  it.each<DicoloreReport>(['pedidos', 'notas', 'titulos', 'resultados'])('updates only %s once after approval', async report => {
    const { reads } = setup(report, true);
    expect(Object.values(reads).every(fn => fn.mock.calls.length === 0)).toBe(true);
    fireEvent.click(await screen.findByRole('button', { name: 'Sim, atualizar' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain(`novo-${report}`));
    expect(reads[report]).toHaveBeenCalledTimes(1);
    for (const other of Object.keys(reads).filter(r => r !== report)) expect(reads[other as DicoloreReport]).not.toHaveBeenCalled();
  });

  it('requires approval for the first load and can update after declining', async () => {
    const { reads } = setup('titulos');
    fireEvent.click(await screen.findByRole('button', { name: 'Não, usar dados salvos' }));
    expect(reads.titulos).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar dados' }));
    await waitFor(() => expect(reads.titulos).toHaveBeenCalledTimes(1));
  });

  it('asks again on reentry but not on resume and retains local data', async () => {
    const { reads } = setup('titulos', true);
    fireEvent.click(await screen.findByRole('button', { name: 'Sim, atualizar' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('novo-titulos'));
    fireEvent.click(screen.getByText('catálogo')); fireEvent.click(screen.getByText('relatório'));
    fireEvent.click(await screen.findByRole('button', { name: 'Não, usar dados salvos' }));
    expect(screen.getByRole('status').textContent).toContain('novo-titulos');
    await act(async () => { focusManager.setFocused(false); focusManager.setFocused(true); });
    expect(reads.titulos).toHaveBeenCalledTimes(1);
  });

  it('preserves saved data on a failed update with no automatic retry', async () => {
    const { reads } = setup('titulos', true);
    reads.titulos.mockRejectedValue(new Error('Sem rede'));
    fireEvent.click(await screen.findByRole('button', { name: 'Sim, atualizar' }));
    await waitFor(() => expect(reads.titulos).toHaveBeenCalledTimes(1));
    await screen.findByText('Não foi possível atualizar. Os dados salvos foram preservados.');
    expect(screen.getByRole('status').textContent).toContain('salvo-titulos');
  });

  it('does not let another account or changed seller scope reuse local reports', async () => {
    const { client, reads } = setup('titulos', true);
    fireEvent.click(await screen.findByRole('button', { name: 'Não, usar dados salvos' }));
    const saved = dehydrate(client);
    cleanup();
    mock.access = { ...mock.access, user: { id: 'seller-B' }, staffSellerCodes: ['28'] };
    const second = setup('titulos'); hydrate(second.client, saved);
    fireEvent.click(await screen.findByRole('button', { name: 'Não, usar dados salvos' }));
    expect(screen.getByRole('status').textContent).not.toContain('salvo-titulos');
    expect(reads.titulos).not.toHaveBeenCalled();
    expect(second.reads.titulos).not.toHaveBeenCalled();
  });

  it('waits for confirmed access before allowing reports or a first fetch', async () => {
    mock.access.loading = true;
    const { reads } = setup('titulos');
    await act(async () => { await Promise.resolve(); });
    expect(reads.titulos).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Sim, atualizar' })).toBeNull();
  });

  it('keeps local search on the saved base without a new remote query', async () => {
    const client = new QueryClient(); clients.push(client);
    const read = vi.fn().mockResolvedValue(['JOSE', 'MARIA']);
    client.setQueryData(scopedReportKey(['customer-titles', 'store-A', ''], scope()), ['JOSE', 'MARIA']);
    function Search() {
      const [search, setSearch] = useState('');
      const term = useDicoloreRemoteTerm(search);
      const { data = [] } = useDicoloreQuery({ queryKey: ['customer-titles', 'store-A', term], queryFn: read });
      return <><input aria-label="buscar" value={search} onChange={e => setSearch(e.target.value)} /><output>{data.filter(v => v.includes(search)).join('|')}</output></>;
    }
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dicolore/vendedor/titulos']}><DicoloreReportBoundary><Search /></DicoloreReportBoundary></MemoryRouter></QueryClientProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Não, usar dados salvos' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'MARIA' } });
    expect(screen.getByRole('status').textContent).toBe('MARIA');
    expect(read).not.toHaveBeenCalled();
  });

  it('updates clients automatically while preserving the visible saved portfolio', async () => {
    const client = new QueryClient(); clients.push(client);
    const read = vi.fn().mockResolvedValue(['novo-cliente']);
    client.setQueryData(scopedReportKey(['store-customer-profiles', 'store-A', '46'], scope()), ['cliente-salvo']);
    function Customers() {
      const { data = [] } = useDicoloreQuery({ queryKey: ['store-customer-profiles', 'store-A', '46'], queryFn: read });
      return <output>{data.join('|')}</output>;
    }
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dicolore/vendedor/clientes']}><DicoloreReportBoundary><Customers /></DicoloreReportBoundary></MemoryRouter></QueryClientProvider>);
    expect(screen.getByRole('status').textContent).toBe('cliente-salvo');
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('novo-cliente'));
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('does not update reports offline or on reconnection after declining', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { reads } = setup('titulos', true);
    fireEvent.click(await screen.findByRole('button', { name: 'Não, usar dados salvos' }));
    expect(screen.getByRole('button', { name: 'Atualizar dados' })).toBeDisabled();
    act(() => window.dispatchEvent(new Event('online')));
    expect(screen.getByRole('button', { name: 'Atualizar dados' })).toBeEnabled();
    expect(reads.titulos).not.toHaveBeenCalled();
  });

  it('does not expose the same account\'s previous portfolio after seller scope changes', async () => {
    const { client } = setup('titulos', true);
    fireEvent.click(await screen.findByRole('button', { name: 'Não, usar dados salvos' }));
    const saved = dehydrate(client); cleanup();
    mock.access.staffSellerCodes = ['28'];
    const second = setup('titulos'); hydrate(second.client, saved);
    fireEvent.click(await screen.findByRole('button', { name: 'Não, usar dados salvos' }));
    expect(screen.getByRole('status').textContent).toBe('');
    expect(second.reads.titulos).not.toHaveBeenCalled();
  });

  it('keeps other stores on their existing query behavior', async () => {
    const { reads } = setup('titulos', false, '/jewosnewborn/titulos');
    await waitFor(() => expect(reads.titulos).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: 'Sim, atualizar' })).toBeNull();
  });
});