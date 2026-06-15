## Problema

O card **"Ativar notificações"** já existe no painel da loja (`/dicolore/admin`), mas não aparece para a Luciana (nem para nenhum vendedor da Dicolore). Por isso ela entra/sai do sistema e não vê nada para ativar.

### Causa

O hook `useMySellerId` (em `src/hooks/usePushNotifications.ts`) tenta descobrir o `seller_id` do usuário logado de 2 formas:

1. Lê `store_users.seller_id` — **está NULL para todos os 15 usuários da Dicolore**.
2. Faz um fallback comparando o `store_users.name` com `store_sellers.name` (removendo só a palavra "televendas").

Mas na Dicolore os nomes não batem:

| store_users.name | store_sellers.name |
|---|---|
| Luciana **Rep** | Luciana |
| Adriana **Rep** | Adriana |
| Baty | **Bety** |
| Denise **TeleVendas** | Televendas **Denise** |
| Grazi **TeleVendas** | Televendas **Grazi** |
| Rolando Rep | **Ronaldo** |
| Suellen Rep | **Suelen** |

Resultado: o hook devolve `null` → o `PushNotificationsCard` retorna `null` → o vendedor não vê o botão de ativar.

Já existe, porém, uma informação 100% confiável em cada `store_users`: a coluna **`seller_codes`** (array de códigos do vendedor). Para a Luciana é `[4]`, e existe um `store_sellers` com `code=4`. Isso resolve sem depender de nomes.

## Solução

Ajustar o `useMySellerId` para resolver o `seller_id` usando, nesta ordem:

1. `store_users.seller_id` direto (se preenchido).
2. **Novo:** primeiro código de `store_users.seller_codes` → buscar em `store_sellers` por `code` (na mesma loja, ativo). Esse é o caminho que vai funcionar para a Luciana e demais vendedores da Dicolore.
3. Fallback atual por nome (mantido só por compatibilidade), porém normalizando também os sufixos comuns: `rep`, `representante`, `televendas`, `tele vendas`, `tv`, e acentos.

Com isso, ao entrar em `/dicolore/admin`, a Luciana (e todos os outros) passarão a ver o card:

> 🔔 **Receba aviso de novos pedidos** — [Ativar notificações]

Basta clicar uma vez, autorizar a permissão no navegador, e a partir daí cada pedido pendente da Dicolore vinculado ao código dela vai disparar a notificação push (Follow Up) já configurada.

## Como o vendedor ativa (passo a passo que vou orientar)

1. Entrar em `meupedidonozap.online/dicolore/admin` com o login dela.
2. No topo da página de Pedidos vai aparecer o card amarelo/azul **"Receba aviso de novos pedidos"**.
3. Clicar em **Ativar notificações** → o navegador pede permissão → clicar em **Permitir**.
4. Pronto. O texto passa a mostrar **"Notificações de novos pedidos ativadas"** com botão Desativar.

Observações importantes (limitações do navegador, não do sistema):
- **Celular Android / Chrome / Edge / Firefox no PC**: funciona direto.
- **iPhone (Safari)**: só funciona se o site for **instalado como app** (compartilhar → "Adicionar à Tela de Início") e depois abrir pelo ícone. Caso contrário o iOS não permite push.
- Precisa ativar **uma vez por aparelho/navegador** (cada dispositivo registra a sua própria inscrição).

## Arquivos alterados

- `src/hooks/usePushNotifications.ts` — melhorar o `useMySellerId` para resolver pelo `seller_codes` antes do fallback por nome, e normalizar sufixos (`Rep`, `TeleVendas`, etc.) no fallback.

Nenhuma migração de banco é necessária e nenhuma outra rotina é afetada.
