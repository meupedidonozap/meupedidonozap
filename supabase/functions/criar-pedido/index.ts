import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { cliente_nome, cliente_telefone, itens, total, store_id, origem, observacoes } = body;

    if (!cliente_nome || !itens || !total || !store_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: cliente_nome, itens, total, store_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("orders")
      .insert({
        store_id,
        customer: { name: cliente_nome, phone: cliente_telefone || "" },
        items: typeof itens === "string" ? [{ description: itens }] : itens,
        total: Number(total),
        subtotal: Number(total),
        status: "pendente",
        origem: origem || "whatsapp",
        payment_method: "dinheiro",
        delivery_shift: "manha",
        observations: observacoes || null,
      })
      .select("id, order_number")
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, order_number: data.order_number, order_id: data.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
