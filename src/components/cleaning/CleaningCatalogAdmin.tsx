import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Pencil, Plus, Check, Loader2 } from "lucide-react";
import { Field, Choice } from "./CleaningFields";
import {
  useCleaningCatalog,
  useCleaningActions,
  type CleaningCatalog,
} from "@/hooks/useCleaning";
import { cleaningMoney, cleaningCatalogSchema } from "@/lib/cleaning";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
export default function CleaningCatalogAdmin({ storeId }: { storeId: string }) {
  const { data: catalog = [] } = useCleaningCatalog(storeId);
  const actions = useCleaningActions(storeId);
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState<CleaningCatalog | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [kind, setKind] = useState("service");
  const [mode, setMode] = useState("per_m2");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  function edit(c?: CleaningCatalog) {
    setItem(c || null);
    setName(c?.products?.name || "");
    setPrice(c?.price_ready ? String(c.products?.base_price || "") : "");
    setKind(c?.kind || "service");
    setMode(c?.mode || "per_m2");
    setReady(c?.price_ready || false);
    setOpen(true);
  }
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg">Catálogo de serviços e adicionais</h2>
        <Button onClick={() => edit()}>
          <Plus />
          Novo produto / serviço
        </Button>
      </div>
      <div className="divide-y border-y">
        {catalog.map((c) => (
          <div key={c.id} className="flex items-center gap-4 py-4">
            {c.products?.image_url && (
              <img
                src={c.products.image_url}
                alt={c.products.name}
                className="h-16 w-20 rounded-md object-contain bg-card"
              />
            )}
            <div className="min-w-0 flex-1">
              <h3>{c.products?.name}</h3>
              <p className="text-sm text-muted-foreground">
                {c.kind === "service" ? "Serviço" : "Adicional"} ·{" "}
                {c.mode === "per_m2"
                  ? "por m²"
                  : c.mode === "percent"
                    ? "percentual"
                    : "valor fixo"}
              </p>
              <p className="mt-1 font-medium text-primary">
                {c.mode === "percent" && c.price_ready
                  ? `${c.products?.base_price}%`
                  : cleaningMoney(
                      c.price_ready ? (c.products?.base_price ?? null) : null,
                    )}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              title="Editar produto"
              onClick={() => edit(c)}
            >
              <Pencil />
            </Button>
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
              {item ? "Editar produto / serviço" : "Novo produto / serviço"}
            </DialogTitle>
            <DialogDescription>
              Preço próprio da Limpa Telhas Brusque
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const validation = cleaningCatalogSchema.safeParse({
                name,
                price: price || 0,
                ready,
                kind,
                mode: kind === "service" ? "per_m2" : mode,
              });
              if (!validation.success) {
                toast.error(validation.error.issues[0]?.message);
                return;
              }
              setBusy(true);
              try {
                await actions.run(() =>
                  supabase.rpc("cleaning_save_catalog", {
                    p_store: storeId,
                    p_id: item?.id as unknown as string,
                    p_name: name,
                    p_price: Number(price || 0),
                    p_ready: ready,
                    p_kind: kind,
                    p_mode: kind === "service" ? "per_m2" : mode,
                    p_image: item?.products?.image_url || "",
                  }),
                );
                setOpen(false);
                toast.success("Produto salvo.");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Nome" value={name} onChange={setName} required />
            <Choice
              label="Tipo"
              value={kind}
              onChange={setKind}
              options={[
                ["service", "Serviço"],
                ["addon", "Adicional"],
              ]}
            />
            {kind === "addon" && (
              <Choice
                label="Cobrança"
                value={mode}
                onChange={setMode}
                options={[
                  ["per_m2", "Por m²"],
                  ["fixed", "Valor fixo"],
                  ["percent", "Percentual do serviço"],
                ]}
              />
            )}
            <Field
              label={
                kind === "service" || mode === "per_m2"
                  ? "Preço por m² (R$)"
                  : mode === "percent"
                    ? "Percentual (%)"
                    : "Preço (R$)"
              }
              type="number"
              value={price}
              onChange={setPrice}
              min={ready ? "0.01" : "0"}
              step="0.01"
              required={ready}
            />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={ready}
                onCheckedChange={(v) => setReady(v === true)}
              />
              Preço definido / disponível para orçamento
            </label>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Check />}Salvar
              produto
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
