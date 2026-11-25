import { Capacitor, registerPlugin, type PermissionState } from '@capacitor/core';

interface MpzAndroidPlugin {
  savePdf(options: { filename: string; data: string }): Promise<{ saved: boolean }>;
  checkContactsPermission(): Promise<{ contacts: PermissionState }>;
  requestContactsPermission(): Promise<{ contacts: PermissionState }>;
  openSettings(): Promise<void>;
}

export const MpzAndroid = registerPlugin<MpzAndroidPlugin>('MpzAndroid');

export function isAndroidApp(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export function isDicoloreAndroid(): boolean {
  return isAndroidApp() && window.location.pathname.split('/')[1] === 'dicolore';
}

export function fileBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível preparar o PDF.'));
    reader.onload = () => {
      const value = reader.result;
      if (typeof value !== 'string' || !value.includes(',')) {
        reject(new Error('Arquivo PDF inválido.'));
        return;
      }
      resolve(value.slice(value.indexOf(',') + 1));
    };
    reader.readAsDataURL(file);
  });
}

export async function saveAndroidPdf(file: File): Promise<boolean> {
  if (!Capacitor.isPluginAvailable('MpzAndroid')) {
    throw new Error('Instale a nova versão do APK para salvar PDFs.');
  }
  const result = await MpzAndroid.savePdf({ filename: file.name, data: await fileBase64(file) });
  return result.saved;
}

export async function shareAndroidPdf(file: File): Promise<void> {
  if (!Capacitor.isPluginAvailable('Filesystem') || !Capacitor.isPluginAvailable('Share')) {
    throw new Error('Instale a nova versão do APK para compartilhar PDFs.');
  }
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'), import('@capacitor/share'),
  ]);
  // Remove earlier exports on the next share; never store customer PDFs publicly.
  const directory = 'mpz-pdf-share';
  await Filesystem.rmdir({ path: directory, directory: Directory.Cache, recursive: true }).catch(() => undefined);
  const { uri } = await Filesystem.writeFile({
    path: `${directory}/${file.name}`, directory: Directory.Cache,
    data: await fileBase64(file), recursive: true,
  });
  try {
    await Share.share({ files: [uri], title: file.name, dialogTitle: 'Compartilhar PDF' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/cancel/i.test(message)) throw error;
  }
}