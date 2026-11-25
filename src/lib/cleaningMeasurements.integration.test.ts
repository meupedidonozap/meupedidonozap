import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import type { Database } from "@/integrations/supabase/types";

describe.skipIf(process.env.CLEANING_MEASUREMENTS_INTEGRATION !== "1")("Metragem oficial e segurança", () => {
  const client = createClient<Database>(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const anon = createClient<Database>(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  let store = "", profile = "", service = "", price = 0;
  const ids: string[] = [];
  const site = { cep: "88350000", address: "Rua QA TESTE MEDIDAS", number: "99", neighborhood: "Centro", city: "Brusque", uf: "SC", complement: "" };
  const input = () => ({ items: [{ service_id: service, area: 1 }], roof_areas: [{ service_id: service, mode: "dimensions", length: 10, width: 10, slope: 30 }, { service_id: service, mode: "known", area: 50 }], addon_ids: [], height: 2, access: "facil", water: true, electricity: true, has_solar: false, falls: 2, site_address: site, notes: "QA TESTE MEDIDAS INTEGRACAO" });
  beforeAll(async () => {
    await client.auth.setSession(JSON.parse(readFileSync(`${homedir()}/.cache/lovable-auth/session.json`, "utf8")).session);
    const s = await client.from("stores").select("id").eq("slug", "limpa-telhas-brusque").single();
    if (s.error) throw s.error;
    store = s.data.id;
    const c = await client.from("cleaning_catalog").select("id,products(base_price)").eq("store_id", store).eq("kind", "service").limit(1).single();
    if (c.error || !c.data.products) throw new Error("Serviço necessário");
    service = c.data.id; price = c.data.products.base_price;
    const cp = await client.from("customer_profiles").insert({ store_id: store, name: "QA TESTE MEDIDAS INTEGRACAO", cpf_cnpj: "52998224725", whatsapp: "47999990000", ...site, number: "10" }).select("id").single();
    if (cp.error) throw cp.error;
    profile = cp.data.id;
  });
  afterAll(() => writeFileSync("/tmp/browser/cleaning-areas/integration-cleanup.json", JSON.stringify({ profile, ids })));
  it("servidor ignora 1 m² adulterado e calcula 130+50=180 m²", async () => {
    const r = await client.rpc("cleaning_create_quote", { p_store: store, p_profile: profile, p_key: crypto.randomUUID(), p_input: input() });
    expect(r.error).toBeNull();
    if (!r.data) throw new Error("Orçamento necessário"); ids.push(r.data.id);
    const lines = r.data.items as { area: number; total: number }[];
    expect(lines[0].area).toBe(180); expect(lines[0].total).toBe(180 * price);
    expect(r.data.total).toBeNull();
  });
  it("reenvio da mesma solicitação não duplica", async () => {
    const key = crypto.randomUUID();
    const a = await client.rpc("cleaning_create_quote", { p_store: store, p_profile: profile, p_key: key, p_input: input() });
    expect(a.error).toBeNull(); if (!a.data) throw new Error("Orçamento necessário"); ids.push(a.data.id);
    const b = await client.rpc("cleaning_create_quote", { p_store: store, p_profile: profile, p_key: key, p_input: input() });
    expect(b.error).toBeNull(); expect(b.data?.id).toBe(a.data.id);
  });
  it("recusa inclinação negativa no servidor", async () => {
    const body=input(); body.roof_areas[0].slope=-1;
    const r=await client.rpc("cleaning_create_quote",{p_store:store,p_profile:profile,p_key:crypto.randomUUID(),p_input:body});
    expect(r.error?.message).toContain("Medidas inválidas");
  });
  it("não aceita outro endereço com identificador de trajeto inventado", async () => {
    const r=await client.rpc("cleaning_create_quote",{p_store:store,p_profile:profile,p_key:crypto.randomUUID(),p_input:{...input(),travel_estimate_id:crypto.randomUUID()}});
    expect(r.error?.message).toContain("Recalcule o deslocamento");
  });
  it("recusa faixas de 1–2 e 2–4 sobrepostas", async () => {
    const r=await client.rpc("cleaning_save_estimate_settings",{p_store:store,p_settings:{base_address:null,round_trip:true,solar_price:null,fall_ranges:[{min:1,max:2,price:50},{min:2,max:4,price:100}]}});
    expect(r.error?.message).toContain("sobrepor");
  });
  it("impede transformar cobrança ida e volta em somente ida", async () => {
    const r=await client.rpc("cleaning_save_estimate_settings",{p_store:store,p_settings:{base_address:null,round_trip:false,solar_price:null,fall_ranges:[]}});
    expect(r.error?.message).toContain("inválida");
  });
  it("visitante não muda base nem lê estimativas privadas", async () => {
    const r=await anon.rpc("cleaning_save_estimate_settings",{p_store:store,p_settings:{base_address:null,round_trip:true,solar_price:0,fall_ranges:[]}});
    expect(r.error).not.toBeNull();
    const estimates=await anon.from("cleaning_travel_estimates").select("id").eq("store_id",store);
    expect(!!estimates.error || estimates.data?.length===0).toBe(true);
  });
  it("preserva contrato antigo sem campos novos", async () => {
    const body=input();
    const legacy={items:[{service_id:service,area:100}],addon_ids:[],height:body.height,access:body.access,water:body.water,electricity:body.electricity,notes:body.notes};
    const r=await client.rpc("cleaning_create_quote",{p_store:store,p_profile:profile,p_key:crypto.randomUUID(),p_input:legacy});
    expect(r.error).toBeNull(); if(!r.data) throw new Error("Orçamento necessário");ids.push(r.data.id);
    expect(r.data.total).toBe(100 * price);
  });
});
