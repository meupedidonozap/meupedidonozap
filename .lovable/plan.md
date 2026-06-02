## Diagnóstico

Verifiquei o banco da **Pastelaria RM** (`pastelariarm26`):

- O pedido **#228** (origem `mesa`, status `pendente`) foi gravado às **19:38** — **depois** da correção do trigger `notify_new_pending_order`.
- Nas últimas 2 horas: **4 pedidos** entraram com sucesso (#226, #227, #228 + 1).
- Não há mais erro de `extensions.http_post` — o trigger agora usa `net.http_post` corretamente.

**Conclusão:** o backend está gravando os pedidos normalmente. O erro que o usuário continua vendo é o **bundle JavaScript antigo em cache** no navegador dele (a versão anterior à correção, que tentava o INSERT e quebrava). Service Worker + cache do navegador estão segurando a versão velha.

Observação secundária: os `order_number` saltam (203 → 223 → 226). Isso é normal — a sequência incrementa mesmo em INSERTs que deram rollback (pelo trigger antigo). Não é bug atual; é vestígio das tentativas que falharam antes da correção. Não há "limite" de pedidos sequenciais, nem problema de cadastro de produto causando o erro.

## Plano

### 1. Forçar invalidação de cache para todos os usuários (1 deploy)

Adicionar um **bump de versão** no Service Worker (`public/sw.js`) com uma constante `SW_VERSION` nova. O SW já tem `self.skipWaiting()` no `install` e `clients.claim()` no `activate` — basta mudar a versão para que o navegador detecte um SW novo, descarte o antigo e recarregue os assets.

Em conjunto, no `src/main.tsx`, ao detectar `updatefound` no registro do SW, recarregar a aba automaticamente uma vez (com guarda em `sessionStorage` pra não cair em loop). Isso garante que, na próxima vez que o lojista abrir a Pastelaria RM, ele puxa o bundle novo automaticamente — sem precisar pedir pra ele limpar cache na mão nem fazer login de novo (auth/cart são preservados).

### 2. Instruções imediatas pro lojista (sem código)

Enquanto o deploy não chega na máquina dele, mando o link de "limpeza assistida" que já existe no projeto:

```
https://meupedidonozap.lovable.app/pastelariarm26?limpar
```

O `main.tsx` já trata `?limpar`: limpa `caches` + desregistra SW, **preservando carrinho e sessão Supabase**. Após isso a página recarrega limpa. **Não força logout.**

### 3. Rastrear erros futuros de gravação de pedido

Hoje, se o INSERT em `orders` falhar, o erro só aparece no `toast` do navegador e some. Vou adicionar instrumentação leve:

- Em `useCreateOrder` (`src/hooks/useOrders.ts`), no `catch` do `mutationFn`, gravar uma linha numa nova tabela `order_create_errors` com: `store_id`, `user_id`, `error_message`, `error_code`, `payload_summary` (qtd itens, total, payment_method), `user_agent`, `created_at`.
- RLS: insert liberado para `authenticated` e `anon` (precisa funcionar mesmo sem login no fluxo de checkout público); select apenas para admins da loja (`has_any_store_access`) + platform admins.
- Aba nova **"Diagnóstico"** dentro de `StoreAdminPage` listando os últimos 50 erros da loja, com botão "limpar". Assim o lojista (e eu) consigo ver na hora se algum pedido específico está falhando e por quê.

### 4. Verificação pós-deploy

Depois de aplicar:
- Confirmar com `SELECT` que pedidos novos da Pastelaria RM continuam entrando.
- Pedir pro lojista abrir `https://meupedidonozap.lovable.app/pastelariarm26?limpar` uma vez e tentar mandar um pedido teste.
- Conferir aba "Diagnóstico" — deve ficar vazia.

## O que **não** vou mexer

- Trigger `notify_new_pending_order` (já corrigido, funcionando).
- Lógica de `order_number` / sequência.
- Cadastro de produtos.
- Fluxo de autenticação (sem forçar logout — preserva sessão e carrinho).
