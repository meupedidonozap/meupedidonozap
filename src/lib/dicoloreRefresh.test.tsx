import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider, QueryObserver, useQuery } from '@tanstack/react-query';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { isStoreData, refreshDicoloreData, SCREEN_DATA, STOCK_DATA } from './dicoloreRefresh';
import { useDicoloreRefresh } from '@/hooks/useDicoloreRefresh';
import { requiresAppUpdate } from './appUpdates';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function observe(key: readonly string[], value: unknown = 'atualizado') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const queryFn = vi.fn().mockResolvedValue(value);
  client.setQueryData(key, 'anterior', { updatedAt: Date.now() - 60_000 });
  const observer = new QueryObserver(client, { queryKey: key, queryFn, staleTime: Infinity });
  const unsubscribe = observer.subscribe(() => {});
  return { client, queryFn, unsubscribe };
}

describe('DiColore workflow refresh', () => {
  it.each([
    ['store-access', 'dicolore-id', 'user-id', 'identity-v2'],
    ['products', 'dicolore-id'],
    ['overdue-titles', 'dicolore-id', '95134'],
    ['store-customer-profiles', 'dicolore-id'],
    ['client-intel-base', 'dicolore-id', '28'],
    ['selected-customer-profile', 'dicolore-id', 'customer-id'],
    ['customer-profile', 'user-id', 'dicolore-id'],
  ])('revalidates %j at entry despite a fresh infinite cache', async (...key) => {
    const { client, queryFn, unsubscribe } = observe(key);
    await refreshDicoloreData(client, 'dicolore', 'dicolore-id', SCREEN_DATA);
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(key)).toBe('atualizado');
    unsubscribe(); client.clear();
  });

  it.each([
    ['seller-orders', 'dicolore-id', '28'],
    ['erp-orders', 'dicolore-id'],
    ['customer-titles', 'dicolore-id', '28', '95134'],
    ['customer-invoices-v2', 'dicolore-id'],
    ['customer-orders', 'user-id', 'dicolore-id'],
    ['results-drill', 'dicolore-id'],
  ])('does not automatically refresh the mounted report %j on entry/resume', async (...key) => {
    const { client, queryFn, unsubscribe } = observe(key);
    await refreshDicoloreData(client, 'dicolore', 'dicolore-id', SCREEN_DATA);
    expect(queryFn).not.toHaveBeenCalled();
    expect(client.getQueryData(key)).toBe('anterior');
    unsubscribe(); client.clear();
  });

  it.each(['jewosnewborn', 'senses'])('leaves %s behavior unchanged', async slug => {
    const { client, queryFn, unsubscribe } = observe(['products', 'other-store']);
    await refreshDicoloreData(client, slug, 'other-store', SCREEN_DATA);
    expect(queryFn).not.toHaveBeenCalled();
    unsubscribe(); client.clear();
  });

  it('never matches a store id in a customer or seller slot', () => {
    expect(isStoreData(['products', 'other-store', 'dicolore-id'], 'dicolore-id', SCREEN_DATA)).toBe(false);
    expect(isStoreData(['customer-profile', 'dicolore-id', 'other-store'], 'dicolore-id', SCREEN_DATA)).toBe(false);
    expect(isStoreData(['customer-profile', 'user-id', 'dicolore-id'], 'dicolore-id', SCREEN_DATA)).toBe(true);
  });

  it('does not fetch an unmounted financial screen or another store', async () => {
    const { client, queryFn, unsubscribe } = observe(['products', 'other-store']);
    const financial = vi.fn().mockResolvedValue([]);
    client.setQueryDefaults(['customer-titles', 'dicolore-id'], { queryFn: financial });
    client.setQueryData(['customer-titles', 'dicolore-id'], []);
    await refreshDicoloreData(client, 'dicolore', 'dicolore-id', SCREEN_DATA);
    expect(queryFn).not.toHaveBeenCalled();
    expect(financial).not.toHaveBeenCalled();
    unsubscribe(); client.clear();
  });

  it('does not fetch while hidden or offline', async () => {
    const { client, queryFn, unsubscribe } = observe(['products', 'dicolore-id']);
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await refreshDicoloreData(client, 'dicolore', 'dicolore-id', STOCK_DATA);
    visibility.mockReturnValue('visible');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await refreshDicoloreData(client, 'dicolore', 'dicolore-id', STOCK_DATA);
    expect(queryFn).not.toHaveBeenCalled();
    unsubscribe(); client.clear();
  });

  it('combines concurrent entry/focus events and does not refetch a just completed read', async () => {
    const { client, queryFn, unsubscribe } = observe(['products', 'dicolore-id']);
    await Promise.all(Array.from({ length: 3 }, () => refreshDicoloreData(client, 'dicolore', 'dicolore-id', STOCK_DATA)));
    await refreshDicoloreData(client, 'dicolore', 'dicolore-id', STOCK_DATA);
    expect(queryFn).toHaveBeenCalledTimes(1);
    unsubscribe(); client.clear();
  });

  it('refreshes stock once on selecting a different customer, with no polling timer', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const queryFn = vi.fn().mockResolvedValue('estoque ERP atual');
    const interval = vi.spyOn(window, 'setInterval');
    function Catalog({ customer }: { customer: string }) {
      const { data } = useQuery({ queryKey: ['products', 'dicolore-id'], queryFn });
      useDicoloreRefresh('dicolore-id', STOCK_DATA, customer);
      return <output>{String(data)}</output>;
    }
    const view = (customer: string) => <QueryClientProvider client={client}><MemoryRouter initialEntries={['/dicolore']}>
      <Routes><Route path="/:slug" element={<Catalog customer={customer} />} /></Routes>
    </MemoryRouter></QueryClientProvider>;
    const rendered = render(view('customer-1'));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(screen.getByText('estoque ERP atual')).toBeInTheDocument();
    expect(queryFn).toHaveBeenCalledTimes(1);
    act(() => client.setQueryData(['products', 'dicolore-id'], 'estoque anterior', { updatedAt: Date.now() - 2000 }));
    rendered.rerender(view('customer-2'));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(screen.getByText('estoque ERP atual')).toBeInTheDocument();
    expect(queryFn).toHaveBeenCalledTimes(2);
    rendered.rerender(view('customer-2'));
    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(interval).not.toHaveBeenCalled();
    rendered.unmount(); client.clear();
  });

  it('ships this improvement without an obligatory update notice', () => {
    expect(requiresAppUpdate({ version: 'new', stores: [] }, '/dicolore/vendedor/vendas', 'old')).toBe(false);
  });
});