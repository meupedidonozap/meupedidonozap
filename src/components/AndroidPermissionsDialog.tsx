import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useLocation } from 'react-router-dom';
import { MapPin, ContactRound, Loader2, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { MpzAndroid, isAndroidApp } from '@/lib/nativeAndroid';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const KEY = 'mpz_android_permissions_v1';
let prompted = false;

export default function AndroidPermissionsDialog() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const eligible = isAndroidApp() && pathname.split('/')[1] === 'dicolore';
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  useEffect(() => {
    if (!eligible || !user || prompted) return;
    if (!Capacitor.isPluginAvailable('MpzAndroid') || !Capacitor.isPluginAvailable('Geolocation')) return;
    try { if (localStorage.getItem(KEY)) return; localStorage.setItem(KEY, '1'); } catch { /* ask once in memory */ }
    prompted = true;
    setOpen(true);
  }, [eligible, user?.id]);

  async function allow() {
    setBusy(true);
    const failures: string[] = [];
    // Android permission dialogs must run sequentially, not concurrently.
    try {
      if (!Capacitor.isPluginAvailable('MpzAndroid')) throw new Error('Instale a nova versão do APK.');
      const current = await MpzAndroid.checkContactsPermission();
      const result = current.contacts === 'granted' ? current : await MpzAndroid.requestContactsPermission();
      if (result.contacts !== 'granted') failures.push('Acesso aos contatos não autorizado.');
    } catch (e) { failures.push(e instanceof Error ? e.message : 'Não foi possível solicitar acesso aos contatos.'); }
    try {
      if (!Capacitor.isPluginAvailable('Geolocation')) throw new Error('Instale a nova versão do APK para habilitar a localização.');
      const { Geolocation } = await import('@capacitor/geolocation');
      const current = await Geolocation.checkPermissions();
      const result = current.location === 'granted' || current.coarseLocation === 'granted'
        ? current : await Geolocation.requestPermissions({ permissions: ['location'] });
      if (result.location !== 'granted' && result.coarseLocation !== 'granted') failures.push('Localização não autorizada.');
    } catch { failures.push('Localização indisponível. Verifique o GPS e as permissões do aplicativo.'); }
    setIssues(failures);
    setBusy(false);
    if (!failures.length) setOpen(false);
  }

  return (
    <Dialog open={open && eligible} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle>Permissões do aplicativo</DialogTitle>
          <DialogDescription>Você pode recusar ou alterar as permissões nas configurações do Android.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="flex gap-2"><MapPin className="h-5 w-5 shrink-0 text-primary" />Localização somente durante o uso, para check-in e check-out.</p>
          <p className="flex gap-2"><ContactRound className="h-5 w-5 shrink-0 text-primary" />Contatos somente para leitura; sua agenda não será importada nem enviada para a loja.</p>
          {issues.map((issue, i) => <p key={i} role="alert" className="text-destructive">{issue}</p>)}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>{issues.length ? 'Fechar' : 'Agora não'}</Button>
          {issues.length ? <Button onClick={() => { void MpzAndroid.openSettings().catch(() => setIssues(['Abra Configurações > Aplicativos > Meu Pedido no Zap > Permissões.'])); }}><Settings className="mr-2 h-4 w-4" />Configurações</Button>
            : <Button disabled={busy} onClick={() => void allow()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Permitir</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}