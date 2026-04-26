import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Não autorizado" }, 401);
    }

    // Verify caller identity using anon client + token
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return json({ error: "Sessão inválida" }, 401);
    }
    const callerId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const { storeId, customerProfileId, newPassword } = body || {};
    if (!storeId || !customerProfileId || !newPassword) {
      return json({ error: "Parâmetros obrigatórios faltando" }, 400);
    }
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return json({ error: "Senha precisa ter no mínimo 6 caracteres" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Caller must be store admin OR platform admin
    const { data: isStoreAdmin } = await admin.rpc("is_store_admin", {
      _user_id: callerId,
      _store_id: storeId,
    });
    const { data: isPlatformAdmin } = await admin.rpc("is_platform_admin", {
      _user_id: callerId,
    });
    if (!isStoreAdmin && !isPlatformAdmin) {
      return json({ error: "Sem permissão" }, 403);
    }

    // Look up the customer profile and ensure it belongs to the store
    const { data: profile, error: profErr } = await admin
      .from("customer_profiles")
      .select("id, user_id, store_id, name")
      .eq("id", customerProfileId)
      .maybeSingle();
    if (profErr || !profile) {
      return json({ error: "Cliente não encontrado" }, 404);
    }
    if (profile.store_id !== storeId) {
      return json({ error: "Cliente não pertence a esta loja" }, 403);
    }
    if (!profile.user_id) {
      return json(
        { error: "Este cliente ainda não possui conta de acesso." },
        400,
      );
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(
      profile.user_id,
      { password: newPassword },
    );
    if (updErr) {
      return json({ error: updErr.message }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message || "Erro inesperado" }, 500);
  }

  function json(b: unknown, status = 200) {
    return new Response(JSON.stringify(b), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});