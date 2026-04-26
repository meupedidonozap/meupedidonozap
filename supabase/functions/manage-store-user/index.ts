import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Action = "create" | "update" | "delete" | "reset_password";

interface Permissions {
  can_view_service_orders?: boolean;
  can_manage_service_orders?: boolean;
  can_view_orders?: boolean;
  can_manage_orders?: boolean;
  can_manage_products?: boolean;
  can_view_customers?: boolean;
}

interface Body {
  action: Action;
  storeId: string;
  storeUserId?: string;
  email?: string;
  password?: string;
  name?: string;
  permissions?: Permissions;
  isActive?: boolean;
}

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return json({ error: "Sessão inválida" }, 401);
    }
    const callerId = userData.user.id;

    const body = (await req.json().catch(() => ({}))) as Body;
    const { action, storeId } = body;
    if (!action || !storeId) {
      return json({ error: "action e storeId são obrigatórios" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verifica se o chamador é admin principal da loja ou platform admin
    const { data: isStoreAdmin } = await admin.rpc("is_store_admin", {
      _user_id: callerId,
      _store_id: storeId,
    });
    const { data: isPlatformAdmin } = await admin.rpc("is_platform_admin", {
      _user_id: callerId,
    });
    if (!isStoreAdmin && !isPlatformAdmin) {
      return json({ error: "Sem permissão para gerenciar usuários" }, 403);
    }

    const perms: Permissions = body.permissions ?? {};
    const permRow = {
      can_view_service_orders: !!perms.can_view_service_orders,
      can_manage_service_orders: !!perms.can_manage_service_orders,
      can_view_orders: !!perms.can_view_orders,
      can_manage_orders: !!perms.can_manage_orders,
      can_manage_products: !!perms.can_manage_products,
      can_view_customers: !!perms.can_view_customers,
    };

    if (action === "create") {
      const { email, password, name } = body;
      if (!email || !password || password.length < 6) {
        return json({ error: "Email e senha (min 6) obrigatórios" }, 400);
      }

      // Cria ou recupera usuário
      let userId: string | null = null;
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr) {
        if (createErr.message?.toLowerCase().includes("already") || createErr.message?.toLowerCase().includes("exists")) {
          const { data: list } = await admin.auth.admin.listUsers();
          const existing = list?.users?.find((u) => u.email === email);
          if (!existing) return json({ error: "Usuário existe mas não foi localizado" }, 409);
          userId = existing.id;
          await admin.auth.admin.updateUserById(userId, { password });
        } else {
          return json({ error: createErr.message }, 500);
        }
      } else {
        userId = created.user.id;
      }

      // Garante que não é admin principal da loja (não faz sentido restringir)
      const { data: alreadyAdmin } = await admin
        .from("store_admins")
        .select("id")
        .eq("store_id", storeId)
        .eq("user_id", userId!)
        .maybeSingle();
      if (alreadyAdmin) {
        return json({ error: "Este usuário já é admin principal desta loja" }, 409);
      }

      const { data: inserted, error: insErr } = await admin
        .from("store_users")
        .upsert(
          {
            store_id: storeId,
            user_id: userId!,
            email,
            name: name || email,
            is_active: true,
            ...permRow,
          },
          { onConflict: "store_id,user_id" },
        )
        .select()
        .single();
      if (insErr) return json({ error: insErr.message }, 500);

      return json({ ok: true, storeUser: inserted });
    }

    if (action === "update") {
      const { storeUserId } = body;
      if (!storeUserId) return json({ error: "storeUserId obrigatório" }, 400);
      const updateData: Record<string, unknown> = { ...permRow };
      if (typeof body.isActive === "boolean") updateData.is_active = body.isActive;
      if (body.name) updateData.name = body.name;

      const { data, error: updErr } = await admin
        .from("store_users")
        .update(updateData)
        .eq("id", storeUserId)
        .eq("store_id", storeId)
        .select()
        .single();
      if (updErr) return json({ error: updErr.message }, 500);
      return json({ ok: true, storeUser: data });
    }

    if (action === "delete") {
      const { storeUserId } = body;
      if (!storeUserId) return json({ error: "storeUserId obrigatório" }, 400);
      const { error: delErr } = await admin
        .from("store_users")
        .delete()
        .eq("id", storeUserId)
        .eq("store_id", storeId);
      if (delErr) return json({ error: delErr.message }, 500);
      return json({ ok: true });
    }

    if (action === "reset_password") {
      const { storeUserId, password } = body;
      if (!storeUserId || !password || password.length < 6) {
        return json({ error: "storeUserId e senha (min 6) obrigatórios" }, 400);
      }
      const { data: row } = await admin
        .from("store_users")
        .select("user_id, store_id")
        .eq("id", storeUserId)
        .maybeSingle();
      if (!row || row.store_id !== storeId) {
        return json({ error: "Usuário não encontrado nesta loja" }, 404);
      }
      const { error: updErr } = await admin.auth.admin.updateUserById(row.user_id, { password });
      if (updErr) return json({ error: updErr.message }, 500);
      return json({ ok: true });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message || "Erro inesperado" }, 500);
  }
});