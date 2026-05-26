## Trocar Senha — Painel do Lojista

Adicionar bloco "Trocar Senha" no topo da aba **Configurações** (`/:slug/admin` → Configurações), ao lado/abaixo do Logo da Empresa, disponível para todos os lojistas em todas as lojas.

### UI (em `StoreAdminPage.tsx`, aba Configurações)
Novo card "Segurança da Conta" com:
- Email do usuário logado (somente leitura, para confirmar qual conta está sendo alterada)
- Campo **Nova senha** (mínimo 6 caracteres)
- Campo **Confirmar nova senha**
- Botão **Atualizar Senha**
- Validações: senhas iguais, mínimo 6 caracteres
- Toast de sucesso/erro

### Lógica
Usar diretamente o SDK do Supabase no client:
```ts
await supabase.auth.updateUser({ password: novaSenha })
```
Não precisa de senha atual (a sessão já autentica o usuário). Não precisa de edge function nem migration.

Após sucesso, limpar os campos e mostrar toast "Senha atualizada com sucesso".

### Escopo
- Funciona para **qualquer lojista logado** em **qualquer loja** (admin principal ou store_user secundário).
- Altera a senha da própria conta do usuário autenticado.
- Não afeta outras lojas/usuários.

### Arquivo
- `src/pages/StoreAdminPage.tsx` — adicionar componente `ChangePasswordCard` no topo da aba Configurações (antes do card "Informações da Loja").
