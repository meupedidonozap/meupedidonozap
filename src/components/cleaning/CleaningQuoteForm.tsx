import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Field, Choice, Notes } from "./CleaningFields";
import { Check, Plus, ArrowRight, Loader2, MapPin } from "lucide-react";
import { cleaningMoney, cleaningTotal, cleaningQuoteSchema } from "@/lib/cleaning";
import { useCleaningCatalog, useCleaningActions, type CleaningQuote } from "@/hooks/useCleaning";
import { useCleaningEstimateSettings, estimateCleaningTravel, type CleaningTravelEstimate } from "@/hooks/useCleaningEstimate";
import { roofAreaSchema, serviceAreas, newRoofArea, emptySiteAddress, siteAddressSchema, fallSurcharge, areaLabel, type RoofAreaDraft, type SiteAddress } from "@/lib/cleaningMeasurements";
import CleaningRoofAreas from "./CleaningRoofAreas";
import CleaningAddressFields from "./CleaningAddressFields";
import CleaningServiceImage from "./CleaningServiceImage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function CleaningQuoteForm({ storeId, profileId, onAuth, onSaved }: {
  storeId: string; profileId?: string; onAuth?: () => void; onSaved: (q: CleaningQuote) => void;
}) {
  const { data: catalog = [], isLoading, error } = useCleaningCatalog(storeId);
  const settingsQuery = useCleaningEstimateSettings(storeId);
  const settings = settingsQuery.data;
  const actions = useCleaningActions(storeId);
  const [areas, setAreas] = useState<RoofAreaDraft[]>([]);
  const [addons, setAddons] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [height, setHeight] = useState("");
  const [access, setAccess] = useState("facil");
  const [water, setWater] = useState(true);
  const [electricity, setElectricity] = useState(true);
  const [hasSolar, setHasSolar] = useState("nao");
  const [falls, setFalls] = useState("2");
  const [siteAddress, setSiteAddress] = useState<SiteAddress>(emptySiteAddress);
  const [travel, setTravel] = useState<{ estimate: CleaningTravelEstimate; signature: string } | null>(null);
  const [travelBusy, setTravelBusy] = useState(false);
  const [travelError, setTravelError] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const signature = JSON.stringify({ siteAddress, base: settings?.base_address });
  const latestSignature = useRef(signature);
  latestSignature.current = signature;
  const currentTravel = travel?.signature === signature ? travel.estimate : null;
  const profileQuery = useQuery({ queryKey: ["cleaning", "site-profile", storeId, profileId], enabled: !!profileId, queryFn: async () => {
    const { data, error } = await supabase.from("customer_profiles").select("cep,address,number,neighborhood,city,uf,complement").eq("store_id", storeId).eq("id", profileId || "").single();
    if (error) throw error;
    return data;
  }});
  const initializedProfile = useRef("");
  useEffect(() => {
    if (!profileId || !profileQuery.data || initializedProfile.current === profileId) return;
    initializedProfile.current = profileId;
    setSiteAddress({ ...profileQuery.data, cep: profileQuery.data.cep.replace(/\D/g, ""), complement: profileQuery.data.complement || "" });
  }, [profileId, profileQuery.data]);
  const services = catalog.filter(c => c.kind === "service");
  const extras = catalog.filter(c => c.kind === "addon");
  const selected = services.filter(s => areas.some(a => a.service_id === s.id));
  const measurements = useMemo(() => areas.flatMap(a => {
    const parsed = roofAreaSchema.safeParse(a);
    return parsed.success ? [parsed.data] : [];
  }), [areas]);
  const grouped = serviceAreas(measurements);
  const solar = hasSolar === "sim" ? settings?.solar_price ?? null : 0;
  const fallPrice = fallSurcharge(Number(falls), settings?.fall_ranges || []);
  const serviceTotal = cleaningTotal(grouped.map(a => {
    const s = services.find(s => s.id === a.service_id);
    return { area: a.area, unit_price: s?.price_ready ? s.products?.base_price ?? null : null };
  }), extras.filter(c => addons.includes(c.id)).map(c => ({ mode: c.mode, price: c.price_ready ? c.products?.base_price ?? null : null })));
  const total = serviceTotal !== null && solar !== null && fallPrice !== null && currentTravel ? Math.round((serviceTotal + solar + fallPrice + currentTravel.total) * 100) / 100 : null;
  async function calculateTravel() {
    if (!profileId) { onAuth?.(); return; }
    const parsed = siteAddressSchema.safeParse(siteAddress);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message); return; }
    setTravelBusy(true); setTravelError("");
    const requestSignature = signature;
    try {
      const estimate = await estimateCleaningTravel(storeId, parsed.data);
      if (latestSignature.current === requestSignature) setTravel({ estimate, signature: requestSignature });
    } catch (e) {
      if (latestSignature.current === requestSignature) setTravelError(e instanceof Error ? e.message : "Não foi possível calcular o deslocamento.");
    } finally { setTravelBusy(false); }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!profileId) { onAuth?.(); return; }
    const parsed = cleaningQuoteSchema.safeParse({ items: grouped, roof_areas: areas, addon_ids: addons, notes, height: height || 0, access, water, electricity, has_solar: hasSolar === "sim", falls, site_address: siteAddress, ...(currentTravel ? { travel_estimate_id: currentTravel.id } : {}) });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message); return; }
    if (settings?.base_address && !currentTravel) { toast.error("Calcule o deslocamento antes de salvar o orçamento."); return; }
    setBusy(true);
    try {
      const q = await actions.createQuote(profileId, key, parsed.data);
      setKey(crypto.randomUUID()); onSaved(q); toast.success("Orçamento salvo.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar."); }
    finally { setBusy(false); }
  }
  if (isLoading || settingsQuery.isLoading) return <Loader2 className="mx-auto animate-spin" />;
  if (error || settingsQuery.error) return <p role="alert" className="text-destructive">Não foi possível carregar os serviços e valores.</p>;
  return <form onSubmit={submit} className="space-y-8">
    <section>
      <h2 className="mb-4 text-lg">1 · Serviços</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {services.map(s => {
          const chosen = selected.some(c => c.id === s.id);
          return <div key={s.id} className={`overflow-hidden rounded-lg border bg-card ${chosen ? "border-primary ring-1 ring-primary" : ""}`}>
            <CleaningServiceImage src={s.products?.image_url} name={s.products?.name || "Serviço"} />
            <div className="space-y-3 p-4">
              <h3 className="min-h-12 text-base">{s.products?.name}</h3>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-primary">{cleaningMoney(s.price_ready ? s.products?.base_price ?? null : null)}{s.price_ready && <span className="text-sm font-normal text-muted-foreground"> / m²</span>}</p>
                <Button type="button" variant={chosen ? "secondary" : "outline"} size="icon" title={chosen ? "Remover serviço" : "Selecionar serviço"} aria-label={`${chosen ? "Remover" : "Selecionar"} ${s.products?.name}`} onClick={() => setAreas(old => chosen ? old.filter(a => a.service_id !== s.id) : [...old, newRoofArea(s.id)])}>{chosen ? <Check /> : <Plus />}</Button>
              </div>
            </div>
          </div>;
        })}
      </div>
    </section>
    <section className="border-t pt-6">
      <h2 className="mb-5 text-lg">2 · Dados do local</h2>
      <CleaningRoofAreas areas={areas} onChange={setAreas} services={selected.map(s => ({ id: s.id, name: s.products?.name || "Serviço" }))} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Altura aproximada do telhado (m)" type="number" value={height} onChange={setHeight} min="0" max="100" step="0.1" />
        <Choice label="Acesso ao telhado" value={access} onChange={setAccess} options={[["facil", "Fácil acesso"], ["restrito", "Acesso restrito"]]} />
        <Choice label="Possui placa solar?" value={hasSolar} onChange={setHasSolar} options={[["nao", "Não"], ["sim", "Sim"]]} />
        <Field label="Quantas águas (quedas) tem o telhado?" type="number" value={falls} onChange={setFalls} min="1" max="100" step="1" required />
      </div>
      <div className="mt-5 flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={water} onCheckedChange={v => setWater(v === true)} />Água disponível</label>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={electricity} onCheckedChange={v => setElectricity(v === true)} />Energia disponível</label>
      </div>
      <h3 className="mb-4 mt-6 text-base font-semibold">Endereço do local</h3>
      <CleaningAddressFields value={siteAddress} onChange={v => { setSiteAddress(v); setTravelError(""); }} />
      <div className="mt-5 space-y-3">
        <p className="text-sm text-muted-foreground">Deslocamento · ida e volta · R$ 1,20/km</p>
        {!settings?.base_address ? <p className="text-sm text-muted-foreground">Deslocamento sob avaliação: base de saída não cadastrada.</p> : <Button type="button" variant="outline" disabled={travelBusy} onClick={calculateTravel}>{travelBusy ? <Loader2 className="animate-spin" /> : <MapPin />}{currentTravel ? "Recalcular deslocamento" : "Calcular deslocamento"}</Button>}
        {currentTravel && <p role="status" className="text-sm font-medium">{areaLabel(currentTravel.total_km)} km (ida e volta) · {cleaningMoney(currentTravel.total)} <span className="text-muted-foreground">· Google Maps</span></p>}
        {travelError && <p role="alert" className="text-sm text-destructive">{travelError}</p>}
      </div>
    </section>
    {!!extras.length && <section className="border-t pt-6"><h2 className="mb-4 text-lg">Adicionais</h2><div className="grid gap-3 sm:grid-cols-2">{extras.map(a => <label key={a.id} className="flex items-center justify-between gap-3 border-b py-3 text-sm"><span className="flex items-center gap-2"><Checkbox checked={addons.includes(a.id)} onCheckedChange={v => setAddons(v === true ? [...addons, a.id] : addons.filter(id => id !== a.id))} />{a.products?.name}</span><span>{cleaningMoney(a.price_ready ? a.products?.base_price ?? null : null)}{a.mode === "per_m2" ? " / m²" : a.mode === "percent" ? " %" : ""}</span></label>)}</div></section>}
    <Notes value={notes} onChange={setNotes} />
    <section className="space-y-3 border-t py-6">
      <div className="flex justify-between gap-4 text-sm"><span>Serviços e adicionais selecionados</span><span>{cleaningMoney(serviceTotal)}</span></div>
      {hasSolar === "sim" && <div className="flex justify-between gap-4 text-sm"><span>Presença de placa solar</span><span>{cleaningMoney(solar)}</span></div>}
      <div className="flex justify-between gap-4 text-sm"><span>{falls} águas (quedas)</span><span>{cleaningMoney(fallPrice)}</span></div>
      <div className="flex justify-between gap-4 text-sm"><span>Deslocamento (ida e volta)</span><span>{cleaningMoney(currentTravel?.total ?? null)}</span></div>
      <div className="flex flex-col justify-between gap-4 pt-4 sm:flex-row sm:items-center">
        <div><p className="text-sm text-muted-foreground">Total do orçamento</p><p className="text-2xl font-bold">{cleaningMoney(total)}</p>{total === null && selected.length > 0 && <Badge variant="secondary">Avaliação da empresa</Badge>}</div>
        <Button size="lg" type="submit" disabled={busy || travelBusy || !selected.length || profileQuery.isFetching}>{busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}{profileId ? "Salvar orçamento" : "Entrar e continuar"}</Button>
      </div>
    </section>
  </form>;
}
