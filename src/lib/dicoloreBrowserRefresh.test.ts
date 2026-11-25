import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshDicoloreData, SCREEN_DATA } from './dicoloreRefresh';

const platform = vi.hoisted(() => ({ android: false }));
vi.mock('@/lib/nativeAndroid', () => ({ isAndroidApp: () => platform.android }));
afterEach(() => vi.restoreAllMocks());

describe('DiColore browser resume refresh', () => {
  it.each([false, true])('refreshes active reports only outside the APK (android=%s)', async android => {
    platform.android = android;
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const client = new QueryClient();
    const queryKey = ['customer-titles', 'store-A'];
    const read = vi.fn().mockResolvedValue(['updated-title']);
    client.setQueryData(queryKey, ['saved-title'], { updatedAt: Date.now() - 5000 });
    const observer = new QueryObserver(client, { queryKey, queryFn: read, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => undefined);
    await refreshDicoloreData(client, 'dicolore', 'store-A', SCREEN_DATA);
    expect(read).toHaveBeenCalledTimes(android ? 0 : 1);
    expect(client.getQueryData(queryKey)).toEqual([android ? 'saved-title' : 'updated-title']);
    unsubscribe(); client.clear();
  });
});