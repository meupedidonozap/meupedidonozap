import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import type { Database } from "@/integrations/supabase/types";

describe.skipIf(process.env.CLEANING_INTEGRATION !== "1")(
  "Limpa Telhas: gravação e isolamento",
  () => {
    const options = {
      auth: { persistSession: false, autoRefreshToken: false },
    };
    const admin = createClient<Database>(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      { auth: { ...options.auth, storageKey: "cleaning-test-admin" } },
    );
    const customer = createClient<Database>(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      { auth: { ...options.auth, storageKey: "cleaning-test-customer" } },
    );
    const anon = createClient<Database>(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      { auth: { ...options.auth, storageKey: "cleaning-test-anon" } },
    );
    let store = "",
      profile = "",
      service = "",
      addon = "",
      quote = "",
      purchase = "",
      inventory = "";
    const blocks: string[] = [];
    const quoteIds: string[] = [];
    const key = crypto.randomUUID();
    const input = () => ({
      items: [{ service_id: service, area: 100 }],
      addon_ids: [addon],
      height: 2,
      access: "facil",
      water: true,
      electricity: true,
      notes: "TESTE QA INTEGRACAO",
      total: 1,
    });
    beforeAll(async () => {
      await admin.auth.setSession(
        JSON.parse(
          readFileSync(`${homedir()}/.cache/lovable-auth/session.json`, "utf8"),
        ).session,
      );
      await customer.auth.setSession(
        JSON.parse(
          readFileSync(
            process.env.CLEANING_CUSTOMER_SESSION ||
              "/tmp/browser/cleaning/customer-session.json",
            "utf8",
          ),
        ).session,
      );
      const {
        data: { user },
      } = await customer.auth.getUser();
      if (!user) throw new Error("Sessão de teste necessária");
      const { data: s } = await admin
        .from("stores")
        .select("id")
        .eq("slug", "limpa-telhas-brusque")
        .single();
      if (!s) throw new Error("Loja necessária");
      store = s.id;
      const { data: p } = await customer
        .from("customer_profiles")
        .select("id")
        .eq("store_id", store)
        .eq("user_id", user.id)
        .single();
      if (!p) throw new Error("Cadastro de teste necessário");
      profile = p.id;
      const { data: catalog } = await admin
        .from("cleaning_catalog")
        .select("id,products(code)")
        .eq("store_id", store);
      service =
        catalog?.find((c) => c.products?.code === "QA-CLEAN-M2")?.id || "";
      addon =
        catalog?.find((c) => c.products?.code === "QA-CLEAN-ADD")?.id || "";
      if (!service || !addon)
        throw new Error("Produtos temporários necessários");
    });
    afterAll(() =>
      writeFileSync(
        "/tmp/browser/cleaning/integration-ids.json",
        JSON.stringify({ quoteIds, blocks, purchase, inventory }),
      ),
    );
    it("calcula 100 m² × R$5 + R$50 no servidor e ignora total adulterado", async () => {
      const { data, error } = await customer.rpc("cleaning_create_quote", {
        p_store: store,
        p_profile: profile,
        p_key: key,
        p_input: input(),
      });
      expect(error).toBeNull();
      if (!data) throw new Error("Orçamento necessário");
      quote = data.id;
      quoteIds.push(quote);
      expect(Number(data.total)).toBe(550);
    });
    it("reenvio não duplica orçamento", async () => {
      const { data, error } = await customer.rpc("cleaning_create_quote", {
        p_store: store,
        p_profile: profile,
        p_key: key,
        p_input: input(),
      });
      expect(error).toBeNull();
      expect(data?.id).toBe(quote);
    });
    it("recusa área zero no servidor", async () => {
      const body = input();
      body.items[0].area = 0;
      const { error } = await customer.rpc("cleaning_create_quote", {
        p_store: store,
        p_profile: profile,
        p_key: crypto.randomUUID(),
        p_input: body,
      });
      expect(error?.message).toContain("Área inválida");
    });
    it("recusa produto de outra loja", async () => {
      const { data: other } = await admin
        .from("cleaning_catalog")
        .select("id")
        .eq("store_id", store)
        .limit(1)
        .single();
      const { data: dico } = await admin
        .from("stores")
        .select("id")
        .eq("slug", "dicolore")
        .single();
      if (!other || !dico) throw new Error("Lojas necessárias");
      const { error } = await customer.rpc("cleaning_create_quote", {
        p_store: dico.id,
        p_profile: profile,
        p_key: crypto.randomUUID(),
        p_input: input(),
      });
      expect(error?.message).toContain("Faça login nesta loja");
    });
    it("cliente não lê financeiro nem altera preço", async () => {
      const { data, error } = await customer
        .from("cleaning_ledger")
        .select("id")
        .eq("store_id", store);
      expect(error).toBeNull();
      expect(data).toEqual([]);
      const result = await customer.rpc("cleaning_save_catalog", {
        p_store: store,
        p_id: service,
        p_name: "Ataque",
        p_price: 1,
        p_ready: true,
        p_kind: "service",
        p_mode: "per_m2",
      });
      expect(result.error?.message).toContain("inválidos");
    });
    it("visitante não lê orçamentos privados", async () => {
      const { data, error } = await anon
        .from("cleaning_quotes")
        .select("id")
        .eq("store_id", store);
      expect(!!error || data?.length === 0).toBe(true);
    });
    it("aceite repetido gera uma OS e uma conta", async () => {
      const first = await customer.rpc("cleaning_accept_quote", {
        p_id: quote,
        p_expected_total: 550,
      });
      expect(first.error).toBeNull();
      const again = await customer.rpc("cleaning_accept_quote", {
        p_id: quote,
        p_expected_total: 550,
      });
      expect(again.error).toBeNull();
      expect(again.data?.service_order_id).toBe(first.data?.service_order_id);
      const { data } = await admin
        .from("cleaning_ledger")
        .select("amount")
        .eq("quote_id", quote);
      expect(data).toHaveLength(1);
      expect(Number(data?.[0].amount)).toBe(550);
    });
    it("bloqueios simultâneos não reservam o mesmo intervalo duas vezes", async () => {
      const start = new Date(Date.now() + 7 * 86400000),
        end = new Date(start.getTime() + 3600000);
      const results = await Promise.all(
        [1, 2].map(() =>
          admin.rpc("cleaning_schedule", {
            p_store: store,
            p_quote: null as unknown as string,
            p_start: start.toISOString(),
            p_end: end.toISOString(),
            p_notes: "TESTE QA INTEGRACAO",
          }),
        ),
      );
      for (const r of results) if (r.data) blocks.push(r.data.id);
      expect(results.filter((r) => !r.error)).toHaveLength(1);
      expect(results.filter((r) => r.error?.code === "23P01")).toHaveLength(1);
    });
    it("reabrir horário cancelado mantém o registro e libera o período", async () => {
      const id = blocks[0];
      if (!id) throw new Error("Bloqueio necessário");
      const { data: before } = await admin
        .from("cleaning_appointments")
        .select("*")
        .eq("id", id)
        .single();
      if (!before) throw new Error("Bloqueio necessário");
      const { error } = await admin.rpc("cleaning_appointment_action", {
        p_id: id,
        p_status: "cancelado",
      });
      expect(error).toBeNull();
      const { data: busy } = await anon.rpc("cleaning_busy", {
        p_store: store,
        p_from: before.starts_at,
        p_to: before.ends_at,
      });
      expect(busy).toEqual([]);
    });
    it("compra cria conta e recebimento repetido entra uma única vez no estoque", async () => {
      const { data: i, error } = await admin
        .from("cleaning_inventory")
        .insert({ store_id: store, name: "TESTE QA INTEGRACAO", quantity: 0 })
        .select()
        .single();
      expect(error).toBeNull();
      if (!i) throw new Error("Estoque necessário");
      inventory = i.id;
      const { data: p, error: pe } = await admin.rpc("cleaning_purchase", {
        p_store: store,
        p_inventory: inventory,
        p_supplier: "TESTE QA INTEGRACAO",
        p_quantity: 2,
        p_total: 100,
        p_due: "2026-12-01",
        p_key: crypto.randomUUID(),
      });
      expect(pe).toBeNull();
      if (!p) throw new Error("Compra necessária");
      purchase = p.id;
      for (let n = 0; n < 2; n++)
        expect(
          (await admin.rpc("cleaning_receive_purchase", { p_id: purchase }))
            .error,
        ).toBeNull();
      const { data: stock } = await admin
        .from("cleaning_inventory")
        .select("quantity")
        .eq("id", inventory)
        .single();
      expect(Number(stock?.quantity)).toBe(2);
      const { data: accounts } = await admin
        .from("cleaning_ledger")
        .select("amount")
        .eq("purchase_id", purchase);
      expect(accounts).toHaveLength(1);
      expect(Number(accounts?.[0].amount)).toBe(100);
    });
  },
);
