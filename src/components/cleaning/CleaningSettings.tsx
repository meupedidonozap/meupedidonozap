import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "./CleaningFields";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import CleaningAddressFields from "./CleaningAddressFields";
import { cleaningEstimateSettingsSchema, emptySiteAddress, type SiteAddress, type CleaningEstimateSettings } from "@/lib/cleaningMeasurements";
import { useCleaningEstimateSettings } from "@/hooks/useCleaningEstimate";
import type { Json } from "@/integrations/supabase/types";
import { useCleaningActions } from "@/hooks/useCleaning";
import { supabase } from "@/integrations/supabase/client";
import { cleaningWhatsApp } from "@/lib/cleaning";
import type { Store } from "@/types";
import { toast } from "sonner";
export default function CleaningSettings({ store }: { store: Store }) {
  const query = useCleaningEstimateSettings(store.id);
  if (query.error) return <p role="alert" className="text-destructive">Não foi possível carregar as configurações.</p>;
  if (!query.isFetchedAfterMount || !query.data) return <Loader2 className="animate-spin" aria-label="Carregando configurações" />;
  return <CleaningSettingsForm store={store} initial={query.data} />;
}
function CleaningSettingsForm({ store, initial }: { store: Store; initial: CleaningEstimateSettings }) {
  const actions = useCleaningActions(store.id);
  const [name, setName] = useState(store.name);
  const [whatsapp, setWhatsapp] = useState(store.whatsapp);
  const [busy, setBusy] = useState(false);
  const [hasBase, setHasBase] = useState(!!initial.base_address);
  const [base, setBase] = useState<SiteAddress>(initial.base_address || emptySiteAddress);
  const [solar, setSolar] = useState(initial.solar_price === null ? "" : String(initial.solar_price));
  const [ranges, setRanges] = useState(initial.fall_ranges.map(r => ({ id: crypto.randomUUID(), min: String(r.min), max: String(r.max), price: String(r.price) })));
  const [estimateBusy, setEstimateBusy] = useState(false);
  return (
    <div className="space-y-8">
      <form
        className="grid max-w-xl gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim() || !cleaningWhatsApp(whatsapp, "")) {
            toast.error("Informe nome e WhatsApp com DDD.");
            return;
          }
          setBusy(true);
          try {
            await actions.run(() =>
              supabase
                .from("stores")
                .update({
                  name: name.trim(),
                  whatsapp: whatsapp.replace(/\D/g, ""),
                })
                .eq("id", store.id)
                .select()
                .single(),
            );
            toast.success("Configurações salvas.");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 className="text-lg">Empresa</h2>
        <Field label="Nome da loja" value={name} onChange={setName} required />
        <Field
          label="WhatsApp de recebimento"
          value={whatsapp}
          onChange={setWhatsapp}
          required
        />
        <Button className="justify-self-start" type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Check />}Salvar
          configurações
        </Button>
      </form>
      <form className="max-w-3xl space-y-6 border-t pt-6" onSubmit={async e => {
        e.preventDefault();
        const parsed = cleaningEstimateSettingsSchema.safeParse({ base_address: hasBase ? base : null, round_trip: true, solar_price: solar === "" ? null : Number(solar), fall_ranges: ranges.map(r => ({ min: Number(r.min), max: Number(r.max), price: r.price === "" ? Number.NaN : Number(r.price) })) });
        if (!parsed.success) { toast.error(parsed.error.issues[0]?.message); return; }
        setEstimateBusy(true);
        try {
          await actions.run(() => supabase.rpc("cleaning_save_estimate_settings", { p_store: store.id, p_settings: parsed.data as unknown as Json }));
          toast.success("Base e adicionais salvos.");
        } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar."); }
        finally { setEstimateBusy(false); }
      }}>
        <h2 className="text-lg">Base de saída e orçamento</h2>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={hasBase} onCheckedChange={v => setHasBase(v === true)} />Base de saída cadastrada</label>
        {hasBase && <CleaningAddressFields value={base} onChange={setBase} />}
        <p className="text-sm text-muted-foreground">Deslocamento: ida e volta · R$ 1,20 por km rodado.</p>
        <Field label="Adicional por presença de placa solar (R$)" type="number" min="0" max="999999" step="0.01" value={solar} onChange={setSolar} placeholder="Sob avaliação" />
        <section className="space-y-4">
          <h3 className="text-base font-semibold">Adicional por águas (quedas)</h3>
          {ranges.map((r, index) => <div key={r.id} className="flex items-end gap-2 border-b pb-4">
            <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-3">
              <Field label={`De (quedas) — faixa ${index + 1}`} type="number" min="1" max="100" step="1" required value={r.min} onChange={v => setRanges(old => old.map(x => x.id === r.id ? { ...x, min: v } : x))} />
              <Field label={`Até (quedas) — faixa ${index + 1}`} type="number" min="1" max="100" step="1" required value={r.max} onChange={v => setRanges(old => old.map(x => x.id === r.id ? { ...x, max: v } : x))} />
              <Field label={`Adicional (R$) — faixa ${index + 1}`} type="number" min="0" max="999999" step="0.01" required value={r.price} onChange={v => setRanges(old => old.map(x => x.id === r.id ? { ...x, price: v } : x))} />
            </div>
            <Button type="button" variant="ghost" size="icon" className="shrink-0" title="Remover faixa" aria-label={`Remover faixa ${index + 1}`} onClick={() => setRanges(old => old.filter(x => x.id !== r.id))}><Trash2 /></Button>
          </div>)}
          <Button type="button" variant="outline" disabled={ranges.length >= 20} onClick={() => setRanges(old => [...old, { id: crypto.randomUUID(), min: "", max: "", price: "" }])}><Plus />Adicionar faixa de quedas</Button>
        </section>
        <Button type="submit" disabled={estimateBusy}>{estimateBusy ? <Loader2 className="animate-spin" /> : <Check />}Salvar base e adicionais</Button>
      </form>
      <section className="border-t pt-6">
        <h2 className="mb-3 text-lg">Regras da loja</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Serviços cobrados por metro quadrado, com preços por produto e
          adicionais cadastrados em Serviços e Configurações. Metragem estimada:
          comprimento × largura × (1 + inclinação/100), somando todas as áreas por serviço.
          Placas solares e quedas usam adicionais cadastrados. Deslocamento considera
          a base atual e o endereço do local, ida e volta a R$ 1,20/km. A alteração
          da base vale para novos orçamentos, sem alterar os valores já salvos.
          Orçamentos sem preço, faixa de quedas ou base cadastrada aguardam
          avaliação da empresa. O cliente aceita o valor disponível antes de
          solicitar o agendamento. Horários solicitados aguardam confirmação da
          empresa; horários confirmados e bloqueados não podem se sobrepor.
          Orçamento aceito gera atendimento e conta a receber. Recebimento da
          compra atualiza estoque; pagamento gera movimento de caixa. Dados
          exclusivos desta loja.
        </p>
      </section>
    </div>
  );
}
