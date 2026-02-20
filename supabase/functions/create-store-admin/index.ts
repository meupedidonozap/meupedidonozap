import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Cliente com service role para operações admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verificar o chamador via token
    const { data: { user: callerUser }, error: callerError } = await supabaseAdmin.auth.getUser(token);
    if (callerError || !callerUser) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar se o chamador é platform admin
    const { data: isAdmin } = await supabaseAdmin.rpc('is_platform_admin', { _user_id: callerUser.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Acesso negado: não é administrador da plataforma' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { email, password, store_id } = await req.json();

    if (!email || !password || !store_id) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios: email, password, store_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'A senha deve ter no mínimo 6 caracteres' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let userId: string;

    // Tentar criar o usuário via Admin API (não afeta sessão do chamador)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      // Se o usuário já existe, buscar pelo email
      if (createError.message?.includes('already') || createError.message?.includes('exists')) {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existing = existingUsers?.users?.find(u => u.email === email);
        if (!existing) {
          return new Response(JSON.stringify({ error: 'Usuário já existe mas não foi possível localizá-lo' }), {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        userId = existing.id;

        // Atualizar a senha do usuário existente
        await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      } else {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      userId = newUser.user.id;
    }

    // Vincular usuário à loja via service role (sem RLS)
    const { error: linkError } = await supabaseAdmin.from('store_admins').insert({
      store_id,
      user_id: userId,
    });

    if (linkError) {
      if (linkError.message?.includes('duplicate') || linkError.code === '23505') {
        return new Response(JSON.stringify({ success: true, message: 'Este usuário já é admin desta loja' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: linkError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, userId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
