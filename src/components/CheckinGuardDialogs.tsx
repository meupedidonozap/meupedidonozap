import { Loader2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatDistance } from '@/lib/checkinPolicy';

interface Props {
  /** Cliente sem coordenada salva: a posição atual será gravada como ponto do cliente. */
  firstPoint: { name: string; lat: number; lng: number } | null;
  saving: boolean;
  onConfirmFirstPoint: () => void;
  onCancelFirstPoint: () => void;
  /** Cliente com coordenada salva e usuário fora do raio: o check-in não é registrado. */
  blocked: { name: string; distance: number } | null;
  radius: number;
  onCloseBlocked: () => void;
}

export default function CheckinGuardDialogs({
  firstPoint, saving, onConfirmFirstPoint, onCancelFirstPoint, blocked, radius, onCloseBlocked,
}: Props) {
  return (
    <>
      <AlertDialog open={!!firstPoint} onOpenChange={(o) => { if (!o && !saving) onCancelFirstPoint(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ATENÇÃO</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Esta é a coordenada que será gravada no sistema para o próximo Checkin, deseja Continuar?</p>
                {firstPoint && (
                  <p className="rounded-md border bg-muted/40 p-2 text-foreground">
                    <b>{firstPoint.name}</b><br />
                    {firstPoint.lat.toFixed(6)}, {firstPoint.lng.toFixed(6)}{' '}
                    <a
                      className="underline"
                      href={`https://www.google.com/maps?q=${firstPoint.lat},${firstPoint.lng}`}
                      target="_blank" rel="noreferrer"
                    >Ver no mapa</a>
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={(e) => { e.preventDefault(); onConfirmFirstPoint(); }}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!blocked} onOpenChange={(o) => { if (!o) onCloseBlocked(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Check-in bloqueado: fora do raio</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {blocked && (
                  <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-foreground">
                    Você está a <b>{formatDistance(blocked.distance)}</b> do ponto registrado de <b>{blocked.name}</b>.
                    O check-in só é permitido a até <b>{radius} m</b> do cliente.
                  </p>
                )}
                <p>Nenhuma visita foi registrada. Vá até o local do cliente e tente novamente. Se o ponto do cliente estiver errado, peça a correção ao administrador.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={onCloseBlocked}>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
