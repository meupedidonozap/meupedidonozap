import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { store_id } = await req.json();
    if (!store_id) {
      return new Response(JSON.stringify({ error: "store_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const csvRes = await fetch(CSV_URL);
    if (!csvRes.ok) {
      return new Response(JSON.stringify({ error: "Falha ao baixar planilha. Confirme que a planilha está 'Publicada na web' como CSV." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const csvText = await csvRes.text();
    const lines = csvText.split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      return new Response(JSON.stringify({ error: "Planilha vazia" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
    // Aceita tanto colunas do ERP (clicod, clirazsoc...) quanto do modelo do sistema (codigo, nome...)
    const firstIdx = (...names: string[]) => {
      for (const n of names) {
        const i = header.indexOf(n);
        if (i !== -1) return i;
      }
      return -1;
    };
    const iCod = firstIdx("clicod", "codigo");
    const iNome = firstIdx("clirazsoc", "nome");
    const iCpf = firstIdx("clicgccpf", "cpf_cnpj");
    const iCel = firstIdx("clicel", "whatsapp");
    const iCep = firstIdx("clicep", "cep");
    const iUf = firstIdx("cliest", "uf");
    const iCid = firstIdx("clicid", "cidade");
    const iBai = firstIdx("clibai", "bairro");
    const iEnd = firstIdx("cliend", "endereco");
    const iNum = firstIdx("cliendnum", "numero");
    const iCom = firstIdx("cliendcom", "complemento");
    const iRep = firstIdx("clirepcod", "codigo_vendedor");
    const iSit = firstIdx("clisit", "situacao");
    const iTrans = firstIdx("transportadora", "clitrans", "clitransp");

    if (iCod === -1 || iNome === -1) {
      return new Response(JSON.stringify({ error: "Colunas obrigatórias não encontradas (codigo, nome)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Carrega cadastros existentes da loja
    const existing = new Map<string, { id: string }>();
    const PAGE = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("customer_profiles")
        .select("id, customer_code")
        .eq("store_id", store_id)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = data || [];
      for (const r of rows) {
        if (r.customer_code) existing.set(String(r.customer_code), { id: r.id });
      }
      if (rows.length < PAGE) break;
      from += PAGE;
    }

    let created = 0;
    let updated = 0;
    let deactivated = 0;
    const errors: { codigo: string; erro: string }[] = [];
    const sheetCodes = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const codigo = String(cols[iCod] || "").trim();
      const nome = String(cols[iNome] || "").trim();
      if (!codigo || !nome) continue;
      sheetCodes.add(codigo);

      const sit = iSit !== -1 ? String(cols[iSit] || "").trim().toUpperCase() : "A";
      const isActive = sit === "A";

      const payload: Record<string, unknown> = {
        store_id,
        customer_code: codigo,
        name: nome,
        cpf_cnpj: iCpf !== -1 ? String(cols[iCpf] || "").trim() : "",
        whatsapp: iCel !== -1 ? onlyDigits(String(cols[iCel] || "")) : "",
        cep: iCep !== -1 ? String(cols[iCep] || "").trim() : "",
        uf: iUf !== -1 ? String(cols[iUf] || "").trim().toUpperCase().slice(0, 2) : "",
        city: iCid !== -1 ? String(cols[iCid] || "").trim() : "",
        neighborhood: iBai !== -1 ? String(cols[iBai] || "").trim() : "",
        address: iEnd !== -1 ? String(cols[iEnd] || "").trim() : "",
        number: iNum !== -1 ? String(cols[iNum] || "").trim() : "",
        complement: iCom !== -1 ? (String(cols[iCom] || "").trim() || null) : null,
        seller_code: iRep !== -1 ? String(cols[iRep] || "").trim() : "",
        transportadora: iTrans !== -1 ? (String(cols[iTrans] || "").trim() || null) : null,
        is_active: isActive,
      };

      const found = existing.get(codigo);
      if (found) {
        const { error } = await supabase
          .from("customer_profiles")
          .update(payload)
          .eq("id", found.id);
        if (error) errors.push({ codigo, erro: error.message });
        else {
          updated++;
          if (!isActive) deactivated++;
        }
      } else {
        const { error } = await supabase
          .from("customer_profiles")
          .insert({ ...payload, user_id: null });
        if (error) errors.push({ codigo, erro: error.message });
        else created++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        created,
        updated,
        deactivated,
        errors: errors.length,
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