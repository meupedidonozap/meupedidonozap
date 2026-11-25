import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Field } from "./CleaningFields";
import {
  Calendar,
  Check,
  FileText,
  MessageCircle,
  Loader2,
  Eye,
} from "lucide-react";
import {
  cleaningMoney,
  cleaningDate,
  cleaningStatus,
  cleaningWhatsApp,
} from "@/lib/cleaning";
import { useCleaningActions, type CleaningQuote } from "@/hooks/useCleaning";
import CleaningSchedule from "./CleaningSchedule";
import type { Json } from "@/integrations/supabase/types";
import { siteAddressSchema, areaLabel } from "@/lib/cleaningMeasurements";
import { toast } from "sonner";
export function quoteCustomer(q?: CleaningQuote) {
  return (q?.customer || {}) as {
    name?: string;
    whatsapp?: string;
    address?: string;
    number?: string;
    city?: string;
    neighborhood?: string;
  };
}
export function quoteLines(q: CleaningQuote) {
  return q.items as {
    name: string;
    area: number;
    unit_price: number | null;
    total: number | null;
  }[];
}
export function quoteSite(q: CleaningQuote) {
  const details = q.details as Record<string, Json>;
  const parsed = siteAddressSchema.safeParse(details.site_address);
  return parsed.success ? parsed.data : quoteCustomer(q);
}
export function quoteMessage(q: CleaningQuote) {
  const c = quoteCustomer(q);
  const site = quoteSite(q);
  return `*Limpa Telhas Brusque*\nOrçamento #${q.number}\nCliente: ${c.name}\n${quoteLines(
    q,
  )
    .map((l) => `${l.name}: ${l.area} m²`)
    .join(
      "\n",
    )}\n${(q.addons as { name: string; total: number | null }[]).map(a => `${a.name}: ${cleaningMoney(a.total)}`).join("\n")}\nTotal: ${cleaningMoney(q.total)}\nEndereço do local: ${site.address}, ${site.number} — ${site.neighborhood}, ${site.city}\nSituação: ${cleaningStatus[q.status]}\n${q.notes}`;
}
export default function CleaningQuoteList({
  storeId,
  quotes,
  admin = false,
  whatsapp,
}: {
  storeId: string;
  quotes: CleaningQuote[];
  admin?: boolean;
  whatsapp: string;
}) {
  const actions = useCleaningActions(storeId);
  const [schedule, setSchedule] = useState<CleaningQuote | null>(null);
  const [review, setReview] = useState<CleaningQuote | null>(null);
  const [detail, setDetail] = useState<CleaningQuote | null>(null);
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [scheduledMessage, setScheduledMessage] = useState("");
  async function accept(q: CleaningQuote) {
    setBusy(true);
    try {
      const saved = await actions.accept(q);
      setSchedule(saved);
      toast.success("Orçamento aceito.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível aceitar.");
    } finally {
      setBusy(false);
    }
  }
  const link = (q: CleaningQuote) =>
    cleaningWhatsApp(
      admin ? quoteCustomer(q).whatsapp || "" : whatsapp,
      quoteMessage(q),
    );
  return (
    <div className="space-y-3">
      {quotes.length === 0 ? (
        <div className="border-y py-12 text-center">
          <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">Nenhum orçamento.</p>
        </div>
      ) : (
        quotes.map((q) => (
          <article key={q.id} className="rounded-lg border bg-card p-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3>Orçamento #{q.number}</h3>
                  <Badge
                    variant={q.status === "aceito" ? "default" : "secondary"}
                  >
                    {cleaningStatus[q.status]}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {admin ? `${quoteCustomer(q).name} · ` : ""}
                  {cleaningDate(q.created_at)}
                </p>
                <p className="mt-2 text-sm">
                  {quoteLines(q)
                    .map((l) => `${l.name} · ${l.area} m²`)
                    .join(" / ")}
                </p>
              </div>
              <p className="shrink-0 text-xl font-bold text-primary">
                {cleaningMoney(q.total)}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDetail(q)}>
                <Eye />
                Detalhes
              </Button>
              {admin && ["solicitado", "pronto"].includes(q.status) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReview(q);
                    setPrice(q.total?.toString() || "");
                  }}
                >
                  <FileText />
                  Definir valor
                </Button>
              )}
              {q.status === "pronto" && (
                <Button size="sm" disabled={busy} onClick={() => accept(q)}>
                  <Check />
                  Aceitar orçamento
                </Button>
              )}
              {q.status === "aceito" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSchedule(q)}
                >
                  <Calendar />
                  Agendar
                </Button>
              )}
              {link(q) && (
                <Button size="sm" variant="outline" asChild>
                  <a
                    href={link(q) || ""}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle />
                    WhatsApp
                  </a>
                </Button>
              )}
            </div>
          </article>
        ))
      )}
      {schedule && (
        <CleaningSchedule
          storeId={storeId}
          quote={schedule}
          onSaved={(a) =>
            setScheduledMessage(
              `${quoteMessage(schedule)}\nHorário solicitado: ${cleaningDate(a.starts_at, true)}\nAguardando confirmação da empresa.`,
            )
          }
          onClose={() => setSchedule(null)}
        />
      )}
      <Dialog
        open={!!scheduledMessage}
        onOpenChange={(o) => {
          if (!o) setScheduledMessage("");
        }}
      >
        <DialogContent className="cleaning-store">
          <DialogHeader>
            <DialogTitle>Solicitação de horário salva</DialogTitle>
            <DialogDescription>
              Aguardando confirmação da empresa
            </DialogDescription>
          </DialogHeader>
          <Button asChild>
            <a
              href={cleaningWhatsApp(whatsapp, scheduledMessage) || ""}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle />
              Enviar agendamento no WhatsApp
            </a>
          </Button>
          <Button variant="ghost" onClick={() => setScheduledMessage("")}>
            Voltar
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!review}
        onOpenChange={(o) => {
          if (!o && !busy) setReview(null);
        }}
      >
        <DialogContent className="cleaning-store">
          <DialogHeader>
            <DialogTitle>Valor do orçamento #{review?.number}</DialogTitle>
            <DialogDescription>
              {review ? quoteCustomer(review).name : ""}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!review) return;
              setBusy(true);
              try {
                await actions.review(review.id, Number(price));
                setReview(null);
                toast.success("Valor atualizado.");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field
              label="Valor final (R$)"
              type="number"
              value={price}
              onChange={setPrice}
              min="0.01"
              step="0.01"
              required
            />
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Check />}
              Disponibilizar orçamento
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!detail}
        onOpenChange={(o) => {
          if (!o) setDetail(null);
        }}
      >
        <DialogContent className="cleaning-store max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Orçamento #{detail?.number}</DialogTitle>
            <DialogDescription>
              {detail ? quoteCustomer(detail).name : ""}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <p className="text-sm">
                {quoteSite(detail).address}, {quoteSite(detail).number}{" "}
                · {quoteSite(detail).neighborhood} ·{" "}
                {quoteSite(detail).city}
              </p>
              {Array.isArray((detail.details as Record<string, Json>).roof_areas) && <div className="space-y-2 text-sm">
                {((detail.details as Record<string, Json>).roof_areas as { mode: string; length?: number; width?: number; slope?: number; estimated_area: number }[]).map((a, i) => <p key={i}>Área {i + 1}: {areaLabel(a.estimated_area)} m²{a.mode === "dimensions" ? ` · ${a.length} m × ${a.width} m · inclinação ${a.slope}%` : ""}</p>)}
              </div>}
              {quoteLines(detail).map((l, i) => (
                <div
                  className="flex justify-between gap-4 border-b pb-2 text-sm"
                  key={i}
                >
                  <span>
                    {l.name}
                    <br />
                    {l.area} m² × {cleaningMoney(l.unit_price)}
                  </span>
                  <span>{cleaningMoney(l.total)}</span>
                </div>
              ))}
              {(detail.addons as { name: string; total: number | null }[]).map(
                (a, i) => (
                  <p key={i} className="flex justify-between text-sm">
                    <span>{a.name}</span>
                    <span>{cleaningMoney(a.total)}</span>
                  </p>
                ),
              )}
              <p className="text-sm text-muted-foreground">
                Altura:{" "}
                {String((detail.details as Record<string, Json>).height || 0)} m
                · Acesso:{" "}
                {String((detail.details as Record<string, Json>).access) ===
                "facil"
                  ? "fácil"
                  : "restrito"}{" "}
                · Água:{" "}
                {(detail.details as Record<string, Json>).water ? "sim" : "não"}{" "}
                · Energia:{" "}
                {(detail.details as Record<string, Json>).electricity
                  ? "sim"
                  : "não"}
              </p>
              <p className="whitespace-pre-wrap text-sm">{detail.notes}</p>
              <p className="flex justify-between border-t pt-3 font-bold">
                <span>Valor final</span>
                <span>{cleaningMoney(detail.total)}</span>
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
