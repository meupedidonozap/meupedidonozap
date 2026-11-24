import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Pencil, Check, Loader2, Search } from "lucide-react";
import { Field } from "./CleaningFields";
import { useCleaningActions } from "@/hooks/useCleaning";
import { getCustomerError } from "@/lib/customerValidation";
import { mapProfile, type CustomerProfile } from "@/hooks/useCustomerProfile";
import { fetchAddressByCep } from "@/lib/cepLookup";
import { toast } from "sonner";
const empty = {
  name: "",
  cpfCnpj: "",
  whatsapp: "",
  cep: "",
  uf: "SC",
  city: "Brusque",
  neighborhood: "",
  address: "",
  number: "",
  complement: "",
};
export function useCleaningCustomers(storeId: string, enabled = true) {
  return useQuery({
    queryKey: ["cleaning", "customers", storeId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_profiles")
        .select("*")
        .eq("store_id", storeId)
        .order("name");
      if (error) throw error;
      return (data || []).map(mapProfile);
    },
    staleTime: 0,
  });
}
export default function CleaningCustomers({ storeId }: { storeId: string }) {
  const { data: customers = [] } = useCleaningCustomers(storeId);
  const actions = useCleaningActions(storeId);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<CustomerProfile | null>(null);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  function edit(c?: CustomerProfile) {
    setSelected(c || null);
    setForm(
      c
        ? {
            name: c.name,
            cpfCnpj: c.cpfCnpj,
            whatsapp: c.whatsapp,
            cep: c.cep,
            uf: c.uf,
            city: c.city,
            neighborhood: c.neighborhood,
            address: c.address,
            number: c.number,
            complement: c.complement || "",
          }
        : empty,
    );
    setOpen(true);
  }
  async function cep(v: string) {
    setForm((f) => ({ ...f, cep: v }));
    if (v.replace(/\D/g, "").length !== 8) return;
    try {
      const a = await fetchAddressByCep(v);
      if (a)
        setForm((f) => ({
          ...f,
          uf: a.uf,
          city: a.city,
          neighborhood: a.neighborhood,
          address: a.address,
        }));
    } catch {
      toast.error("CEP não encontrado; preencha o endereço.");
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const error = getCustomerError(form);
    if (error) {
      toast.error(error);
      return;
    }
    setBusy(true);
    try {
      const payload = {
        store_id: storeId,
        name: form.name,
        cpf_cnpj: form.cpfCnpj,
        whatsapp: form.whatsapp,
        cep: form.cep,
        uf: form.uf,
        city: form.city,
        neighborhood: form.neighborhood,
        address: form.address,
        number: form.number,
        complement: form.complement,
      };
      await actions.run(() =>
        selected
          ? supabase
              .from("customer_profiles")
              .update(payload)
              .eq("id", selected.id)
              .eq("store_id", storeId)
              .select()
              .single()
          : supabase
              .from("customer_profiles")
              .insert(payload)
              .select()
              .single(),
      );
      setOpen(false);
      toast.success("Cliente salvo.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="mb-5 flex flex-wrap justify-between gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Pesquisar clientes"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar clientes"
          />
        </div>
        <Button onClick={() => edit()}>
          <Plus />
          Novo cliente
        </Button>
      </div>
      <div className="divide-y border-y">
        {customers
          .filter((c) =>
            `${c.name} ${c.whatsapp} ${c.cpfCnpj}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .map((c) => (
            <div className="flex items-center gap-3 py-4" key={c.id}>
              <div className="min-w-0 flex-1">
                <h3>{c.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {c.whatsapp} · {c.city}
                </p>
                <p className="text-sm text-muted-foreground">
                  {c.address}, {c.number}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                title="Editar cliente"
                onClick={() => edit(c)}
              >
                <Pencil />
              </Button>
            </div>
          ))}
        {!customers.length && (
          <p className="py-12 text-center text-muted-foreground">
            Nenhum cliente cadastrado.
          </p>
        )}
      </div>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!busy) setOpen(o);
        }}
      >
        <DialogContent className="cleaning-store max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selected ? "Editar cliente" : "Novo cliente"}
            </DialogTitle>
            <DialogDescription>
              Cadastro da Limpa Telhas Brusque
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={submit}>
            {(
              [
                ["name", "Nome"],
                ["cpfCnpj", "CPF/CNPJ"],
                ["whatsapp", "WhatsApp com DDD"],
                ["cep", "CEP"],
                ["uf", "UF"],
                ["city", "Cidade"],
                ["neighborhood", "Bairro"],
                ["address", "Rua"],
                ["number", "Número"],
                ["complement", "Complemento"],
              ] as [keyof typeof form, string][]
            ).map(([key, label]) => (
              <Field
                key={key}
                label={label}
                value={form[key]}
                onChange={(v) =>
                  key === "cep" ? void cep(v) : setForm({ ...form, [key]: v })
                }
                required={key !== "complement"}
              />
            ))}
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Check />}Salvar
              cliente
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
