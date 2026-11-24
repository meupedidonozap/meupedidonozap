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
import { Plus, Pencil, Check, Loader2, PackageCheck } from "lucide-react";
import { Field, Choice } from "./CleaningFields";
import {
  useCleaningActions,
  type CleaningInventory,
  type CleaningPurchase,
} from "@/hooks/useCleaning";
import {
  cleaningMoney,
  cleaningDate,
  businessDate,
  cleaningInventorySchema,
  cleaningPurchaseSchema,
} from "@/lib/cleaning";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
export default function CleaningInventoryPanel({
  storeId,
  inventory,
  purchases,
  view,
}: {
  storeId: string;
  inventory: CleaningInventory[];
  purchases: CleaningPurchase[];
  view: "inventory" | "purchases";
}) {
  const actions = useCleaningActions(storeId);
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState<CleaningInventory | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("un");
  const [quantity, setQuantity] = useState("0");
  const [minimum, setMinimum] = useState("0");
  const [inventoryId, setInventoryId] = useState("");
  const [supplier, setSupplier] = useState("");
  const [total, setTotal] = useState("");
  const [due, setDue] = useState(businessDate());
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  function edit(i?: CleaningInventory) {
    setItem(i || null);
    setName(i?.name || "");
    setUnit(i?.unit || "un");
    setQuantity(String(i?.quantity || 0));
    setMinimum(String(i?.min_quantity || 0));
    setOpen(true);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const validation =
      view === "purchases"
        ? cleaningPurchaseSchema.safeParse({
            inventory_id: inventoryId,
            supplier,
            quantity,
            total,
            due_date: due,
          })
        : cleaningInventorySchema.safeParse({
            name,
            unit,
            quantity,
            min_quantity: minimum,
          });
    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message);
      return;
    }
    setBusy(true);
    try {
      if (view === "purchases")
        await actions.run(() =>
          supabase.rpc("cleaning_purchase", {
            p_store: storeId,
            p_inventory: inventoryId,
            p_supplier: supplier,
            p_quantity: Number(quantity),
            p_total: Number(total),
            p_due: due,
            p_key: key,
          }),
        );
      else {
        const payload = {
          store_id: storeId,
          name,
          unit,
          quantity: Number(quantity),
          min_quantity: Number(minimum),
        };
        await actions.run(() =>
          item
            ? supabase
                .from("cleaning_inventory")
                .update(payload)
                .eq("id", item.id)
                .eq("store_id", storeId)
                .select()
                .single()
            : supabase
                .from("cleaning_inventory")
                .insert(payload)
                .select()
                .single(),
        );
      }
      setKey(crypto.randomUUID());
      setOpen(false);
      toast.success(
        view === "purchases"
          ? "Compra registrada e conta a pagar criada."
          : "Estoque salvo.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="mb-5 flex justify-end">
        <Button onClick={() => edit()}>
          <Plus />
          {view === "inventory" ? "Novo produto de estoque" : "Nova compra"}
        </Button>
      </div>
      <div className="divide-y border-y">
        {view === "inventory"
          ? inventory.map((i) => (
              <div
                key={i.id}
                className="flex flex-wrap items-center gap-3 py-4"
              >
                <div className="min-w-0 flex-1">
                  <h3>{i.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Mínimo: {i.min_quantity} {i.unit}
                  </p>
                </div>
                <strong>
                  {i.quantity} {i.unit}
                </strong>
                {i.quantity <= i.min_quantity && (
                  <Badge variant="secondary">Estoque baixo</Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  title="Ajustar estoque"
                  onClick={() => edit(i)}
                >
                  <Pencil />
                </Button>
              </div>
            ))
          : purchases.map((p) => (
              <div
                className="flex flex-wrap items-center gap-3 py-4"
                key={p.id}
              >
                <div className="min-w-0 flex-1">
                  <h3>
                    {inventory.find((i) => i.id === p.inventory_id)?.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {p.supplier} · {p.quantity} un ·{" "}
                    {cleaningDate(p.created_at)}
                  </p>
                </div>
                <strong>{cleaningMoney(p.total)}</strong>
                <Badge variant={p.received_at ? "default" : "secondary"}>
                  {p.received_at ? "Recebida" : "A receber"}
                </Badge>
                {!p.received_at && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await actions.receive(p.id);
                        toast.success("Compra recebida; estoque atualizado.");
                      } catch (e) {
                        toast.error(
                          e instanceof Error ? e.message : "Erro ao receber.",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <PackageCheck />
                    Receber
                  </Button>
                )}
              </div>
            ))}
        {(view === "inventory" ? !inventory.length : !purchases.length) && (
          <p className="py-10 text-center text-muted-foreground">
            {view === "inventory"
              ? "Nenhum produto no estoque."
              : "Nenhuma compra."}
          </p>
        )}
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
              {view === "purchases"
                ? "Nova compra"
                : item
                  ? "Ajustar estoque"
                  : "Novo produto"}
            </DialogTitle>
            <DialogDescription>
              {view === "purchases"
                ? "O recebimento atualiza o estoque."
                : "Produtos e materiais usados nos atendimentos"}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
            {view === "inventory" ? (
              <>
                <Field label="Nome" value={name} onChange={setName} required />
                <Field
                  label="Unidade"
                  value={unit}
                  onChange={setUnit}
                  required
                />
                <Field
                  label="Estoque mínimo"
                  type="number"
                  value={minimum}
                  onChange={setMinimum}
                  min="0"
                  step="0.001"
                />
              </>
            ) : (
              <>
                <Choice
                  label="Produto de estoque"
                  value={inventoryId}
                  onChange={setInventoryId}
                  options={inventory.map((i) => [i.id, i.name])}
                />
                <Field
                  label="Fornecedor"
                  value={supplier}
                  onChange={setSupplier}
                  required
                />
                <Field
                  label="Valor total (R$)"
                  type="number"
                  value={total}
                  onChange={setTotal}
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
            <Field
              label="Quantidade"
              type="number"
              value={quantity}
              onChange={setQuantity}
              min={view === "purchases" ? "0.001" : "0"}
              step="0.001"
              required
            />
            <Button
              type="submit"
              disabled={busy || (view === "purchases" && !inventoryId)}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Check />}Salvar
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
