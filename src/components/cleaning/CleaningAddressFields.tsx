import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Field } from "./CleaningFields";
import { fetchAddressByCep } from "@/lib/cepLookup";
import type { SiteAddress } from "@/lib/cleaningMeasurements";

export default function CleaningAddressFields({ value, onChange }: { value: SiteAddress; onChange: (value: SiteAddress) => void }) {
  const current = useRef({ value, onChange });
  current.current = { value, onChange };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    setBusy(false);
    if (value.cep.length !== 8) return;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const found = await fetchAddressByCep(value.cep);
        if (!active) return;
        if (!found) setError("CEP não encontrado. Preencha o endereço.");
        else current.current.onChange({ ...current.current.value, ...found });
      } catch {
        if (active) setError("Não foi possível buscar o CEP. Preencha o endereço.");
      } finally {
        if (active) setBusy(false);
      }
    }, 400);
    return () => { active = false; clearTimeout(timer); };
  }, [value.cep]);
  const set = (key: keyof SiteAddress, text: string) => onChange({ ...value, [key]: key === "cep" ? text.replace(/\D/g, "").slice(0, 8) : key === "uf" ? text.toUpperCase().slice(0, 2) : text });
  return <div className="space-y-3">
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="CEP" value={value.cep} onChange={v => set("cep", v)} required />
      <Field label="Número" value={value.number} onChange={v => set("number", v)} required />
      <div className="sm:col-span-2"><Field label="Rua" value={value.address} onChange={v => set("address", v)} required /></div>
      <Field label="Bairro" value={value.neighborhood} onChange={v => set("neighborhood", v)} required />
      <Field label="Cidade" value={value.city} onChange={v => set("city", v)} required />
      <Field label="UF" value={value.uf} onChange={v => set("uf", v)} required />
      <Field label="Complemento" value={value.complement} onChange={v => set("complement", v)} />
    </div>
    {busy && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Buscando CEP…</p>}
    {error && <p role="status" className="text-sm text-destructive">{error}</p>}
  </div>;
}