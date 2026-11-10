import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { loadBatchCustomers, shouldCreateAccess } from "./batch.ts";

// CSV exportado da planilha de clientes da Dicolore
// (planilha compartilhada como "qualquer pessoa com o link")
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1Z3ETF7f-eD1d84rBpmcHRmVXzgiXFS5efnQgwrwxUHg/export?format=csv";

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { fields.push(current.trim()); current = ""; }
      else current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");

const sanitizeLogin = (v: string) =>
  (v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const buildCustomerEmail = (identity: string, slug: string) =>
  `${sanitizeLogin(identity)}@${(slug || "loja").toLowerCase().replace(/[^a-z0-9]/g, "")}.cliente.local`;

/** Senha do cliente = o próprio código; se tiver menos de 6, completa internamente. */
const buildCustomerPassword = (v: string) => {
  const c = (v || "").trim();
  return c.length >= 6 ? c : `dico${c}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("Configuração indisponível");
    const supabase = createClient(url, key);
    const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Registros normalizados no layout da view dw_cliente
    type Rec = Record<string, string>;
    let records: Rec[] = [];
    let store_id: string = body?.store_id;
    const rowsMode = Array.isArray(body?.rows);

    if (rowsMode) {
      // Modo direto do ERP (script sync_clientes_erp.py): exige token de sincronização
      const token = Deno.env.get("TITLES_SYNC_TOKEN");
      if (!token || req.headers.get("x-sync-token") !== token) return json({ error: "unauthorized" }, 401);
      const slug = String(body.store_slug || "dicolore").trim();
      const { data: st } = await supabase.from("stores").select("id").eq("slug", slug).maybeSingle();
      if (!st) return json({ error: "store not found" }, 404);
      store_id = st.id;
      if (body.rows.length > 5000) return json({ error: "máximo de 5000 linhas por envio" }, 400);
      if (body.rows.some((r: unknown) => !r || typeof r !== "object" || Array.isArray(r))) {
        return json({ error: "Cada linha deve ser um objeto" }, 400);
      }
      records = body.rows.map((r: Record<string, unknown>) => {
        const o: Rec = {};
        for (const [k, v] of Object.entries(r || {})) o[k.toLowerCase()] = v == null ? "" : String(v).trim();
        return o;
      });
    } else {
      if (!store_id) return json({ error: "store_id is required" }, 400);
      const csvRes = await fetch(CSV_URL);
      if (!csvRes.ok) return json({ error: "Falha ao baixar planilha. Confirme que a planilha está 'Publicada na web' como CSV." }, 502);
      const csvText = await csvRes.text();
      const lines = csvText.split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.trim().length > 0);
      if (lines.length < 2) return json({ error: "Planilha vazia" }, 400);
      const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
      const alias: Record<string, string[]> = {
        codigo: ["clicod", "codigo"], razao_social: ["clirazsoc", "nome", "razao_social"],
        cnpj: ["clicgccpf", "cpf_cnpj", "cnpj"], telefone_geral_1: ["clicel", "whatsapp", "telefone_geral_1"],
        endereco_cep: ["clicep", "cep"], endereco_uf: ["cliest", "uf"], endereco_cidade: ["clicid", "cidade"],
        endereco_bairro: ["clibai", "bairro"], endereco_rua: ["cliend", "endereco"], endereco_numero: ["cliendnum", "numero"],
        endereco_complemento: ["cliendcom", "complemento"], vendedor_codigo: ["clirepcod", "codigo_vendedor"],
        situacao: ["clisit", "situacao"], transportadora_codigo: ["transportadora", "clitrans", "clitransp", "clitracod"],
        frete_codigo: ["frete_codigo", "clifrepag"], segmento: ["segmento", "segcod", "codigo_segmento"],
      };
      const idx: Record<string, number> = {};
      for (const [k, names] of Object.entries(alias)) idx[k] = names.map((n) => header.indexOf(n)).find((i) => i !== -1) ?? -1;
      if (idx.codigo === -1 || idx.razao_social === -1) return json({ error: "Colunas obrigatórias não encontradas (codigo, nome)" }, 400);
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        const o: Rec = {};
        for (const [k, j] of Object.entries(idx)) if (j !== -1) o[k] = String(cols[j] || "").trim();
        records.push(o);
      }
    }
    const tableFromSegment = (seg: string): number | null => (Number(String(seg || "").trim()) === 13 ? 4 : null);

    // ERP: consulta apenas códigos/documentos recebidos. CSV mantém leitura completa.
    type ExistingRow = Record<string, unknown> & {
      id: string;
      name: string | null;
      cpf_cnpj: string | null;
      whatsapp: string | null;
      cep: string | null;
      uf: string | null;
      city: string | null;
      neighborhood: string | null;
      address: string | null;
      number: string | null;
      complement: string | null;
      seller_code: string | null;
      transportadora: string | null;
      price_table: number | null;
      is_active: boolean | null;
      user_id: string | null;
    };
    const existing = new Map<string, ExistingRow>();
    // Clientes cadastrados no MPZ (sem código ERP), indexados por CPF/CNPJ para vínculo
    const byDoc = new Map<string, ExistingRow>();
    const PAGE = 1000;
    const indexRows = (rows: Record<string, unknown>[]) => {
      for (const r of rows) {
        if (r.customer_code) existing.set(String(r.customer_code), r as ExistingRow);
        else {
          const d = onlyDigits(String(r.cpf_cnpj || ""));
          if (d.length === 11 || d.length === 14) byDoc.set(d, r as ExistingRow);
        }
      }
    };
    if (rowsMode) {
      indexRows(await loadBatchCustomers(supabase, store_id, records));
    } else {
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase.from("customer_profiles").select("*")
          .eq("store_id", store_id).order("id").range(from, from + PAGE - 1);
        if (error) throw error;
        indexRows(data || []);
        if ((data || []).length < PAGE) break;
      }
    }

    const { data: storeRow } = await supabase
      .from("stores").select("slug").eq("id", store_id).maybeSingle();
    const storeSlug = String(storeRow?.slug || "loja");

    let created = 0;
    let updated = 0;
    let deactivated = 0;
    let skipped = 0;
    const errors: { codigo: string; erro: string }[] = [];
    const sheetCodes = new Set<string>();
    const toUpdate: { id: string; codigo: string; payload: Record<string, unknown> }[] = [];
    const toInsert: Record<string, unknown>[] = [];

    const norm = (v: unknown) => (v == null ? "" : String(v).trim());

    const FREE = (v: string | undefined) => (v ?? "").trim();
    const opt = (r: Rec, k: string) => (k in r ? (FREE(r[k]) || null) : undefined);
    const normFrete = (v: string | undefined) => {
      const x = FREE(v).toUpperCase();
      if (x === "0" || x === "CIF" || x === "C") return "0";
      if (x === "1" || x === "FOB" || x === "F") return "1";
      return null;
    };
    for (const r of records) {
      const codigo = FREE(r.codigo);
      const nome = FREE(r.razao_social);
      if (!codigo || !nome) {
        errors.push({ codigo, erro: "Código e razão social obrigatórios" });
        continue;
      }
      sheetCodes.add(codigo);
      const isActive = FREE(r.situacao || "A").toUpperCase() === "A";
      const payload: Record<string, unknown> = {
        store_id,
        customer_code: codigo,
        name: nome,
        cpf_cnpj: FREE(r.cnpj),
        whatsapp: onlyDigits(r.telefone_geral_1 || r.telefone_geral_2 || ""),
        cep: onlyDigits(r.endereco_cep || ""),
        uf: FREE(r.endereco_uf).toUpperCase().slice(0, 2),
        city: FREE(r.endereco_cidade),
        neighborhood: FREE(r.endereco_bairro),
        address: FREE(r.endereco_rua),
        number: FREE(r.endereco_numero),
        complement: FREE(r.endereco_complemento) || null,
        seller_code: FREE(r.vendedor_codigo),
        transportadora: FREE(r.transportadora_codigo) || null,
        is_active: isActive,
      };
      if ("frete_codigo" in r) payload.frete_codigo = normFrete(r.frete_codigo);
      if (rowsMode) {
        // Campos completos da view dw_cliente
        const extra: Record<string, string> = {
          nome_fantasia: "nome_fantasia", ie: "inscricao_estadual", fisica_juridica: "fisica_juridica",
          suframa: "suframa", tipo: "tipo", telefone_geral_2: "telefone_geral_2", email_nfe: "email_nfe",
          endereco_entrega_rua: "endereco_entrega_rua", endereco_entrega_numero: "endereco_entrega_numero",
          endereco_entrega_bairro: "endereco_entrega_bairro", endereco_entrega_cep: "endereco_entrega_cep",
          endereco_entrega_complemento: "endereco_entrega_complemento", endereco_entrega_cidade: "endereco_entrega_cidade",
          endereco_entrega_uf: "endereco_entrega_uf", cliente_grupo_codigo: "cliente_grupo_codigo",
          cliente_classificacao_codigo: "cliente_classificacao_codigo", regiao_venda_codigo: "regiao_venda_codigo",
          condicao_pagamento_codigo: "condicao_pagamento_codigo", forma_pagamento_codigo: "forma_pagamento_codigo",
          grupo_tributario_codigo: "grupo_tributario_codigo", regime_tributario: "regime_tributario",
          cnae: "cnae", situacao: "situacao",
        };
        for (const [col, key] of Object.entries(extra)) { const v = opt(r, key); if (v !== undefined) payload[col] = v; }
        if ("total_limite_credito" in r) { const n = Number(String(r.total_limite_credito).replace(",", ".")); payload.total_limite_credito = r.total_limite_credito && Number.isFinite(n) ? n : null; }
      }

      const found = existing.get(codigo);
      if (!found) {
        const d = onlyDigits(String(payload.cpf_cnpj || ""));
        const mpz = d ? byDoc.get(d) : undefined;
        if (mpz) {
          // Vincula o cadastro feito no MPZ ao código do ERP (mantém tabela de preço e login)
          byDoc.delete(d);
          existing.set(codigo, mpz);
          toUpdate.push({ id: mpz.id, codigo, payload });
          continue;
        }
      }
      if (found) {
        // Diff: só envia UPDATE se algum campo mudou
        const changed = Object.keys(payload).some((k) => k !== "store_id" && (
          k === "is_active" ? (found.is_active ?? true) !== isActive : norm(found[k]) !== norm(payload[k])));

        if (!changed) {
          skipped++;
          continue;
        }
        toUpdate.push({ id: found.id, codigo, payload });
        if (!isActive && (found.is_active ?? true)) deactivated++;
      } else {
        // Tabela só na criação: ERP (tabela_preco_codigo) ou segmento 13 -> Tab 4
        const tp = Number(FREE(r.tabela_preco_codigo));
        const price_table = Number.isInteger(tp) && tp > 0 ? tp : tableFromSegment(r.segmento || "");
        toInsert.push({ ...payload, price_table, user_id: null });
      }
    }

    // Executa updates em paralelo controlado (lote de N requisições simultâneas)
    const CONCURRENCY = 20;
    for (let i = 0; i < toUpdate.length; i += CONCURRENCY) {
      const slice = toUpdate.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        slice.map((u) =>
          supabase.from("customer_profiles").update(u.payload).eq("id", u.id)
            .then((r) => ({ codigo: u.codigo, error: r.error }))
        )
      );
      for (const r of results) {
        if (r.error) errors.push({ codigo: r.codigo, erro: r.error.message });
        else updated++;
      }
    }

    // Inserts em lote (rápido — uma única chamada por chunk)
    const INSERT_CHUNK = 500;
    for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
      const chunk = toInsert.slice(i, i + INSERT_CHUNK);
      const { error } = await supabase.from("customer_profiles").insert(chunk);
      if (error) {
        // fallback: insere uma a uma para identificar o erro
        for (const row of chunk) {
          const { error: e2 } = await supabase.from("customer_profiles").insert(row);
          if (e2) errors.push({ codigo: String(row.customer_code || ""), erro: e2.message });
          else created++;
        }
      } else {
        created += chunk.length;
      }
    }

    // Cria acesso do cliente (login = código, senha = código) para quem ainda não tem
    let accessCreated = 0;
    const missing: { id: string; code: string }[] = [];
    // Monitor ERP não deve varrer/criar acessos nem redefinir senhas.
    if (shouldCreateAccess(rowsMode)) {
      let f = 0;
      while (true) {
        const { data } = await supabase
          .from("customer_profiles")
          .select("id, customer_code, user_id")
          .eq("store_id", store_id)
          .is("user_id", null)
          .range(f, f + PAGE - 1);
        const rows = data || [];
        for (const r of rows) {
          const code = String(r.customer_code || "").trim();
          if (code) missing.push({ id: r.id, code });
        }
        if (rows.length < PAGE) break;
        f += PAGE;
      }
    }

    const MAX_ACCESS = 400;
    const targets = missing.slice(0, MAX_ACCESS);
    for (let i = 0; i < targets.length; i += 5) {
      const slice = targets.slice(i, i + 5);
      await Promise.all(slice.map(async (t) => {
        const email = buildCustomerEmail(t.code, storeSlug);
        const password = buildCustomerPassword(t.code);
        try {
          let userId: string | null = null;
          const { data: createdUser, error: createErr } = await supabase.auth.admin.createUser({
            email, password, email_confirm: true,
          });
          if (createErr) {
            // já existe: localiza e garante a senha padrão
            const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
            const found = list?.users?.find((u: any) => u.email === email);
            if (found) {
              userId = found.id;
              await supabase.auth.admin.updateUserById(found.id, { password });
            }
          } else {
            userId = createdUser?.user?.id ?? null;
          }
          if (userId) {
            const { error: linkErr } = await supabase
              .from("customer_profiles").update({ user_id: userId }).eq("id", t.id);
            if (!linkErr) accessCreated++;
          }
        } catch (e) {
          errors.push({ codigo: t.code, erro: String(e) });
        }
      }));
    }

    return new Response(
      JSON.stringify({
        success: true,
        access_created: accessCreated,
        access_pending: Math.max(0, missing.length - targets.length),
        created,
        updated,
        skipped,
        deactivated,
        errors: errors.length,
        error_codes: [...new Set(errors.map((e) => e.codigo))],
        error_samples: errors.slice(0, 10),
        total_sheet_rows: sheetCodes.size,
        total_db_rows: existing.size,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});