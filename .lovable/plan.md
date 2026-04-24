# Simplificar criação de senha + Redefinição de senha

## Mudanças no `src/components/CustomerAuthDialog.tsx`

### 1. Simplificar formulário de cadastro
- **Remover** o campo "Confirmar Senha" do estado e do JSX
- **Atualizar** placeholder da senha para `"Crie uma senha simples (mín. 6 caracteres)"`
- **Adicionar** texto auxiliar abaixo do campo: `"Dica: use algo fácil de lembrar, ex: seunome123"`
- **Adicionar** botão de mostrar/ocultar senha (ícones `Eye` / `EyeOff` da `lucide-react`) posicionado dentro do `Input` no canto direito
- Aplicar o mesmo botão de mostrar/ocultar também no campo de senha do **login**

### 2. Adicionar fluxo "Esqueci minha senha"
- Adicionar novo `Step`: `'auth' | 'profile' | 'forgot'`
- Na aba **Entrar**, abaixo do botão, adicionar link discreto: `"Esqueci minha senha"` que muda para `step = 'forgot'`
- Nova tela `forgot`:
  - Campo único de email
  - Texto explicativo: `"Enviaremos um link no seu email para criar uma nova senha."`
  - Botão `"Enviar link"` que chama `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/redefinir-senha' })`
  - Link `"Voltar"` para retornar ao `step = 'auth'`
  - Após sucesso: toast `"Link enviado! Verifique seu email."` e voltar para `auth`

## Nova página `src/pages/ResetPasswordPage.tsx` (criar)

Página pública para o usuário definir a nova senha após clicar no link do email.

- Detecta o token de recuperação automaticamente via `supabase.auth.onAuthStateChange` (evento `PASSWORD_RECOVERY`)
- Formulário com 1 campo: nova senha (com botão mostrar/ocultar)
- Validação: mínimo 6 caracteres
- Ao submeter: `supabase.auth.updateUser({ password })`
- Após sucesso: toast `"Senha redefinida!"` + redireciona para `/` (HomePage) ou para a última loja visitada
- Caso o usuário acesse a página sem um token válido: mostra mensagem `"Link inválido ou expirado"` com botão para voltar

## Roteamento em `src/App.tsx`

- Adicionar nova rota pública: `<Route path="/redefinir-senha" element={<ResetPasswordPage />} />`
- Importar a nova página
- A rota deve ficar **antes** da rota dinâmica `/:slug` para evitar conflito

## Considerações

- O fluxo de reset usa o sistema de email padrão do Lovable Cloud (já funciona sem configuração adicional)
- O link do email leva para `/redefinir-senha` independente da loja, pois o reset não é por tenant
- Após o reset, o usuário pode fazer login normalmente em qualquer loja
- A validação mínima de 6 caracteres é exigência do Supabase Auth e não pode ser reduzida
- O `useAuth` já expõe o necessário; não precisamos adicionar funções novas (chamamos `supabase.auth.resetPasswordForEmail` diretamente)

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/CustomerAuthDialog.tsx` | Modificar (remover confirm, adicionar mostrar senha, adicionar fluxo forgot) |
| `src/pages/ResetPasswordPage.tsx` | Criar |
| `src/App.tsx` | Adicionar rota `/redefinir-senha` |
