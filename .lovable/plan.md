

# Proteger a Pagina /admin com Autenticacao

## Problema

A pagina `/admin` esta completamente aberta -- qualquer pessoa pode acessar digitando a URL. Alem disso, o usuario `meupedidonozap@gmail.com` nao existe no sistema de autenticacao, por isso o login nao funciona.

---

## O que sera feito

### 1. Criar o usuario no sistema de autenticacao

O email `meupedidonozap@gmail.com` com a senha `@Deco@1981` sera registrado no sistema para que o login funcione.

### 2. Criar tabela de administradores da plataforma

Uma nova tabela `platform_admins` sera criada para controlar quem pode acessar o painel `/admin` (diferente dos admins de loja que ja existem em `store_admins`).

```text
platform_admins
  - id (uuid, PK)
  - user_id (uuid, FK -> auth.users)
  - created_at (timestamp)
```

Politicas de seguranca (RLS):
- SELECT: somente o proprio usuario pode verificar se e admin
- INSERT/UPDATE/DELETE: ninguem via API (somente via SQL direto)

### 3. Criar funcao de verificacao

Uma funcao `is_platform_admin(user_id)` sera criada para uso nas politicas de seguranca, similar a `is_store_admin` que ja existe.

### 4. Vincular o usuario como admin da plataforma

Apos criar o usuario, ele sera inserido na tabela `platform_admins`.

### 5. Proteger a pagina AdminPage

A pagina `src/pages/AdminPage.tsx` passara a:
- Verificar se o usuario esta logado
- Verificar se e um admin da plataforma
- Se nao estiver logado: mostrar tela de login (reutilizando o componente `StoreAdminLogin` adaptado ou criando um similar)
- Se estiver logado mas nao for admin: mostrar mensagem de acesso negado
- Adicionar botao de logout no cabecalho

### 6. Criar hook `usePlatformAdmin`

Um novo hook similar ao `useStoreAdmin` que verifica se o usuario logado esta na tabela `platform_admins`.

---

## Arquivos envolvidos

| Arquivo | Acao |
|---|---|
| Migration SQL | Criar tabela `platform_admins`, funcao `is_platform_admin`, inserir usuario |
| `src/hooks/usePlatformAdmin.ts` | Novo hook para verificar admin da plataforma |
| `src/pages/AdminPage.tsx` | Adicionar verificacao de auth + tela de login + logout |

---

## Detalhes Tecnicos

### Hook usePlatformAdmin

```text
usePlatformAdmin()
  -> useAuth() para obter usuario
  -> consulta platform_admins para verificar se user_id existe
  -> retorna { user, isAdmin, loading }
```

### Fluxo da pagina /admin

```text
Usuario acessa /admin
  |
  +-> Nao logado? -> Tela de login (email + senha)
  |
  +-> Logado mas nao e platform_admin? -> "Acesso negado"
  |
  +-> Logado e platform_admin? -> Painel normal + botao Sair
```

