import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const mock = vi.hoisted(() => ({ native: false, path: '/dicolore', available: true, contacts: vi.fn(), requestContacts: vi.fn(), location: vi.fn(), requestLocation: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'authorized-user' } }) }));
vi.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: mock.path }) }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isPluginAvailable: () => mock.available } }));
vi.mock('@/lib/nativeAndroid', () => ({ isAndroidApp: () => mock.native, MpzAndroid: { checkContactsPermission: mock.contacts, requestContactsPermission: mock.requestContacts } }));
vi.mock('@capacitor/geolocation', () => ({ Geolocation: { checkPermissions: mock.location, requestPermissions: mock.requestLocation } }));
import AndroidPermissionsDialog from './AndroidPermissionsDialog';
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mock.native = false; mock.path = '/dicolore'; mock.available = true; });
afterEach(cleanup);
describe('Android permission scope', () => {
  it('never requests Android permissions in a browser', () => {
    render(<AndroidPermissionsDialog />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mock.contacts).not.toHaveBeenCalled();
    expect(mock.location).not.toHaveBeenCalled();
  });
  it('does not change other stores', () => {
    mock.native = true; mock.path = '/jewos';
    render(<AndroidPermissionsDialog />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mock.contacts).not.toHaveBeenCalled();
  });
  it('does not mark the old APK as already prompted before native capabilities are installed', () => {
    mock.native = true; mock.available = false;
    render(<AndroidPermissionsDialog />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem('mpz_android_permissions_v1')).toBeNull();
  });
  it('asks sequentially and still requests GPS when contacts are denied, without reading any agenda', async () => {
    mock.native = true;
    mock.contacts.mockResolvedValue({ contacts: 'prompt' });
    mock.requestContacts.mockResolvedValue({ contacts: 'denied' });
    mock.location.mockResolvedValue({ location: 'prompt', coarseLocation: 'prompt' });
    mock.requestLocation.mockResolvedValue({ location: 'granted', coarseLocation: 'granted' });
    render(<AndroidPermissionsDialog />);
    fireEvent.click(await screen.findByRole('button', { name: /^Permitir$/ }));
    await waitFor(() => expect(mock.requestLocation).toHaveBeenCalledWith({ permissions: ['location'] }));
    expect(mock.requestContacts).toHaveBeenCalledTimes(1);
    expect(mock.requestContacts.mock.invocationCallOrder[0]).toBeLessThan(mock.requestLocation.mock.invocationCallOrder[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent('contatos não autorizado');
  });
});