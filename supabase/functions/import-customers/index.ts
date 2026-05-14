import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RowInput {
  codigo: string;
  nome: string;
  cpf_cnpj?: string;
  whatsapp?: string;
  cep?: string;
  uf?: string;
  cidade?: string;
  bairro?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  codigo_vendedor?: string;
}

function buildEmail(codigo: string, slug: string) {
  const safeSlug = (slug || 'loja').toLowerCase().replace(/[^a-z0-9]/g, '');
  const safeCode = codigo.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${safeCode}@${safeSlug}.cliente.local`;
}

function buildPassword(codigo: string) {
  const c = codigo.trim();
  return c.length >= 6 ? c : `dico${c}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { storeId, rows } = await req.json() as { storeId: string; rows: RowInput[] };
    if (!storeId || !Array.isArray(rows)) {
      return new Response(JSON.stringify({ error: 'Parâmetros inválidos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // permission check: platform admin or store admin
    const { data: isPlatform } = await admin.rpc('is_platform_admin', { _user_id: caller.id });
    if (!isPlatform) {
      const { data: isStore } = await admin.rpc('is_store_admin', { _user_id: caller.id, _store_id: storeId });
      if (!isStore) {
        return new Response(JSON.stringify({ error: 'Acesso negado' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // get store slug
    const { data: store } = await admin.from('stores').select('slug').eq('id', storeId).maybeSingle();
    const slug = store?.slug || 'loja';

    const results: Array<{
      codigo: string;
      nome: string;
      status: 'created' | 'updated' | 'error';
      senha?: string;
      email?: string;
      erro?: string;
    }> = [];

    for (const row of rows) {
      const codigo = String(row.codigo || '').trim();
      const nome = String(row.nome || '').trim();
      if (!codigo) {
        results.push({ codigo: '', nome, status: 'error', erro: 'Código vazio' });
        continue;
      }
      if (!nome) {
        results.push({ codigo, nome: '', status: 'error', erro: 'Nome vazio' });
        continue;
      }

      const email = buildEmail(codigo, slug);
      const password = buildPassword(codigo);

      let userId: string | null = null;
      let action: 'created' | 'updated' = 'created';

      // try to find existing profile by customer_code first
      const { data: existingProfile } = await admin
        .from('customer_profiles')
        .select('id, user_id')
        .eq('store_id', storeId)
        .eq('customer_code', codigo)
        .maybeSingle();

      if (existingProfile?.user_id) {
        userId = existingProfile.user_id;
        action = 'updated';
        // refresh password to keep it = code
        await admin.auth.admin.updateUserById(userId, { password });
      } else {
        // try create auth user
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { customer_code: codigo, store_id: storeId },
        });
        if (createErr) {
          const msg = (createErr.message || '').toLowerCase();
          if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
            // fetch existing user (paginated search)
            let found: any = null;
            for (let page = 1; page <= 20 && !found; page++) {
              const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
              found = list?.users?.find((u: any) => u.email === email);
              if (!list?.users?.length || list.users.length < 1000) break;
            }
            if (!found) {
              results.push({ codigo, nome, status: 'error', erro: 'Usuário existe mas não foi localizado' });
              continue;
            }
            userId = found.id;
            action = 'updated';
            await admin.auth.admin.updateUserById(userId!, { password });
          } else {
            results.push({ codigo, nome, status: 'error', erro: createErr.message });
            continue;
          }
        } else {
          userId = created.user.id;
        }
      }

      // upsert profile
      const profilePayload = {
        store_id: storeId,
        user_id: userId,
        customer_code: codigo,
        name: nome,
        cpf_cnpj: row.cpf_cnpj?.toString() || '',
        whatsapp: row.whatsapp?.toString() || '',
        cep: row.cep?.toString() || '',
        uf: (row.uf?.toString() || '').toUpperCase().slice(0, 2),
        city: row.cidade?.toString() || '',
        neighborhood: row.bairro?.toString() || '',
        address: row.endereco?.toString() || '',
        number: row.numero?.toString() || '',
        complement: row.complemento?.toString() || null,
        seller_code: row.codigo_vendedor?.toString() || '',
        is_active: true,
      };

      if (existingProfile?.id) {
        const { error: upErr } = await admin
          .from('customer_profiles')
          .update(profilePayload)
          .eq('id', existingProfile.id);
        if (upErr) {
          results.push({ codigo, nome, status: 'error', erro: upErr.message });
          continue;
        }
      } else {
        const { error: insErr } = await admin
          .from('customer_profiles')
          .insert(profilePayload);
        if (insErr) {
          results.push({ codigo, nome, status: 'error', erro: insErr.message });
          continue;
        }
      }

      results.push({ codigo, nome, status: action, email, senha: password });
    }

    return new Response(JSON.stringify({ results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});