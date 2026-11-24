import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Check,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { Field, Choice } from "./CleaningFields";
import { useCleaningActions, type CleaningLedger } from "@/hooks/useCleaning";
import {
  cleaningMoney,
  cleaningDate,
  businessDate,
  cleaningAccountSchema,
} from "@/lib/cleaning";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
export default function CleaningFinance({
  storeId,
  ledger,
  view,
}: {
  storeId: string;
  ledger: CleaningLedger[];
  view: "payable" | "receivable" | "cash";
}) {
  const actions = useCleaningActions(storeId);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<CleaningLedger | null>(null);
  const [description, setDescription] = useState("");
  const [party, setParty] = useState("");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState(businessDate());
  const [method, setMethod] = useState("pix");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const period = ledger.filter((l) => {
    const date =
      view === "cash" && l.paid_at
        ? businessDate(new Date(l.paid_at))
        : l.due_date;
    return (!from || date >= from) && (!to || date <= to);
  });
  const rows = period
    .filter((l) => (view === "cash" ? !!l.paid_at : l.kind === view))
    .filter(
      (l) => filter === "all" || (filter === "paid" ? !!l.paid_at : !l.paid_at),
    );
  const incoming = rows
      .filter((l) => l.kind === "receivable")
      .reduce((s, l) => s + l.amount, 0),
    outgoing = rows
      .filter((l) => l.kind === "payable")
      .reduce((s, l) => s + l.amount, 0);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      const validation = cleaningAccountSchema.safeParse({
        description,
        party,
        amount,
        due_date: due,
      });
      if (!validation.success) {
        toast.error(validation.error.issues[0]?.message);
        return;
      }
    }
    setBusy(true);
    try {
      if (selected)
        await actions.run(() =>
          supabase
            .from("cleaning_ledger")
            .update({
              paid_at: new Date().toISOString(),
              payment_method: method,
            })
            .eq("id", selected.id)
            .eq("store_id", storeId)
            .select()
            .single(),
        );
      else
        await actions.run(() =>
          supabase
            .from("cleaning_ledger")
            .insert({
              store_id: storeId,
              kind: view === "payable" ? "payable" : "receivable",
              description,
              party,
              amount: Number(amount),
              due_date: due,
            })
            .select()
            .single(),
        );
      setOpen(false);
      toast.success(selected ? "Pagamento registrado." : "Conta salva.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <Field label="De" type="date" value={from} onChange={setFrom} />
          <Field label="Até" type="date" value={to} onChange={setTo} />
          {view !== "cash" && (
            <Choice
              label="Situação"
              value={filter}
              onChange={setFilter}
              options={[
                ["all", "Todas"],
                ["open", "Em aberto"],
                ["paid", "Pagas"],
              ]}
            />
          )}
        </div>
        {view !== "cash" && (
          <Button
            onClick={() => {
              setSelected(null);
              setDescription("");
              setParty("");
              setAmount("");
              setOpen(true);
            }}
          >
            <Plus />
            Nova conta
          </Button>
        )}
      </div>
      <div className="mb-6 grid gap-5 border-y py-5 sm:grid-cols-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Entradas {view === "cash" ? "realizadas" : ""}
          </p>
          <p className="text-2xl font-bold text-primary">
            {cleaningMoney(incoming)}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">
            Saídas {view === "cash" ? "realizadas" : ""}
          </p>
          <p className="text-2xl font-bold">{cleaningMoney(outgoing)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">
            Saldo {view === "cash" ? "realizado" : "previsto"}
          </p>
          <p className="text-2xl font-bold">
            {cleaningMoney(incoming - outgoing)}
          </p>
        </div>
      </div>
      <div className="divide-y">
        {!rows.length && (
          <p className="py-10 text-center text-muted-foreground">
            Nenhum lançamento neste período.
          </p>
        )}
        {rows.map((l) => (
          <div key={l.id} className="flex flex-wrap items-center gap-3 py-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-primary">
              {l.kind === "receivable" ? (
                <ArrowDownLeft size={18} />
              ) : (
                <ArrowUpRight size={18} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <h3>{l.description}</h3>
              <p className="text-sm text-muted-foreground">
                {l.party} ·{" "}
                {view === "cash"
                  ? `Pago em ${cleaningDate(l.paid_at)}`
                  : `Vence ${cleaningDate(l.due_date)}`}
              </p>
            </div>
            <strong>{cleaningMoney(l.amount)}</strong>
            <Badge variant={l.paid_at ? "default" : "secondary"}>
              {l.paid_at ? "Pago" : "Em aberto"}
            </Badge>
            {!l.paid_at && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelected(l);
                  setOpen(true);
                }}
              >
                <Check />
                Registrar pagamento
              </Button>
            )}
          </div>
        ))}
      </div>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!busy) setOpen(o);
        }}
      >
        <DialogContent className="cleaning-store">
          <DialogHeader>
            <DialogTitle>
              {selected ? "Registrar pagamento" : "Nova conta"}
            </DialogTitle>
            <DialogDescription>
              {selected
                ? `${selected.description} · ${cleaningMoney(selected.amount)}`
                : view === "payable"
                  ? "Conta a pagar"
                  : "Conta a receber"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            {selected ? (
              <Choice
                label="Forma de pagamento"
                value={method}
                onChange={setMethod}
                options={[
                  ["pix", "PIX"],
                  ["dinheiro", "Dinheiro"],
                  ["cartao", "Cartão"],
                  ["transferencia", "Transferência"],
                  ["boleto", "Boleto"],
                ]}
              />
            ) : (
              <>
                <Field
                  label="Descrição"
                  value={description}
                  onChange={setDescription}
                  required
                />
                <Field
                  label="Cliente / Fornecedor"
                  value={party}
                  onChange={setParty}
                />
                <Field
                  label="Valor (R$)"
                  type="number"
                  value={amount}
                  onChange={setAmount}
                  min="0.01"
                  step="0.01"
                  required
                />
                <Field
                  label="Vencimento"
                  type="date"
                  value={due}
                  onChange={setDue}
                  required
                />
              </>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Check />}Salvar
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
