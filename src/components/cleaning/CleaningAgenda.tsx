import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Play, Check, Lock, X, CalendarClock } from "lucide-react";
import { Field } from "./CleaningFields";
import CleaningSchedule from "./CleaningSchedule";
import {
  useCleaningActions,
  type CleaningAppointment,
  type CleaningQuote,
} from "@/hooks/useCleaning";
import { cleaningDate, cleaningStatus, businessDate } from "@/lib/cleaning";
import { quoteCustomer } from "./CleaningQuoteList";
import { toast } from "sonner";
export default function CleaningAgenda({
  storeId,
  appointments,
  quotes,
  attendance = false,
}: {
  storeId: string;
  appointments: CleaningAppointment[];
  quotes: CleaningQuote[];
  attendance?: boolean;
}) {
  const actions = useCleaningActions(storeId);
  const [date, setDate] = useState("");
  const [block, setBlock] = useState(false);
  const [selected, setSelected] = useState<CleaningAppointment | null>(null);
  const [busy, setBusy] = useState(false);
  const rows = appointments
    .filter((a) => !date || businessDate(new Date(a.starts_at)) === date)
    .filter((a) => !attendance || a.status !== "bloqueado");
  async function act(a: CleaningAppointment, status: string) {
    setBusy(true);
    try {
      await actions.appointment(a.id, status);
      toast.success("Atendimento atualizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <Field label="Data" type="date" value={date} onChange={setDate} />
        <Button variant="outline" onClick={() => setBlock(true)}>
          <Lock />
          Bloquear horário
        </Button>
      </div>
      <div className="divide-y border-y">
        {rows.map((a) => {
          const q = quotes.find((q) => q.id === a.quote_id);
          return (
            <article key={a.id} className="py-5">
              <div className="flex flex-wrap items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
                  <Calendar />
                </span>
                <div className="min-w-0 flex-1">
                  <h3>{q ? quoteCustomer(q).name : "Horário bloqueado"}</h3>
                  <p className="text-sm text-muted-foreground">
                    {cleaningDate(a.starts_at, true)} até{" "}
                    {new Intl.DateTimeFormat("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(a.ends_at))}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{a.notes}</p>
                </div>
                <Badge
                  variant={a.status === "confirmado" ? "default" : "secondary"}
                >
                  {cleaningStatus[a.status]}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 sm:pl-14">
                {["solicitado_agenda", "confirmado"].includes(a.status) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelected(a)}
                  >
                    <CalendarClock />
                    {a.status === "solicitado_agenda"
                      ? "Confirmar horário"
                      : "Reagendar"}
                  </Button>
                )}
                {a.status === "confirmado" && (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => act(a, "em_andamento")}
                  >
                    <Play />
                    Iniciar
                  </Button>
                )}
                {["confirmado", "em_andamento"].includes(a.status) && (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => act(a, "concluido")}
                  >
                    <Check />
                    Concluir
                  </Button>
                )}
                {!["cancelado", "concluido"].includes(a.status) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => act(a, "cancelado")}
                  >
                    <X />
                    {a.status === "bloqueado" ? "Reabrir horário" : "Cancelar"}
                  </Button>
                )}
              </div>
            </article>
          );
        })}
        {!rows.length && (
          <p className="py-12 text-center text-muted-foreground">
            Nenhum atendimento neste período.
          </p>
        )}
      </div>
      {block && (
        <CleaningSchedule
          storeId={storeId}
          block
          onClose={() => setBlock(false)}
        />
      )}{" "}
      {selected && (
        <CleaningSchedule
          storeId={storeId}
          appointment={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
