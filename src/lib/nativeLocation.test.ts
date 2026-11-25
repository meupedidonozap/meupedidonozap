import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ check: vi.fn(), request: vi.fn(), position: vi.fn(), available: vi.fn(() => true) }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isPluginAvailable: mock.available } }));
vi.mock('@capacitor/geolocation', () => ({ Geolocation: { checkPermissions: mock.check, requestPermissions: mock.request, getCurrentPosition: mock.position } }));
import { readAndroidLocation } from './nativeLocation';
beforeEach(() => { vi.clearAllMocks(); mock.available.mockReturnValue(true); mock.position.mockResolvedValue({ coords: { latitude: -26.5, longitude: -48.9 } }); });
describe('foreground native location', () => {
  it('asks for location and reads one position for a visit', async () => {
    mock.check.mockResolvedValue({ location: 'prompt', coarseLocation: 'prompt' });
    mock.request.mockResolvedValue({ location: 'granted', coarseLocation: 'granted' });
    expect(await readAndroidLocation({ enableHighAccuracy: true, maximumAge: 0 })).toEqual({ lat: -26.5, lng: -48.9 });
    expect(mock.request).toHaveBeenCalledWith({ permissions: ['location'] });
    expect(mock.position).toHaveBeenCalledTimes(1);
    expect(mock.position).toHaveBeenCalledWith({ enableHighAccuracy: true, maximumAge: 0 });
  });
  it('honors approximate location without requiring precise permission again', async () => {
    mock.check.mockResolvedValue({ location: 'denied', coarseLocation: 'granted' });
    await readAndroidLocation({ enableHighAccuracy: true });
    expect(mock.request).not.toHaveBeenCalled();
    expect(mock.position).toHaveBeenCalledWith({ enableHighAccuracy: false });
  });
  it('denial never reads a position', async () => {
    mock.check.mockResolvedValue({ location: 'prompt', coarseLocation: 'prompt' });
    mock.request.mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });
    await expect(readAndroidLocation({})).rejects.toMatchObject({ code: 'OS-PLUG-GLOC-0003' });
    expect(mock.position).not.toHaveBeenCalled();
  });
});