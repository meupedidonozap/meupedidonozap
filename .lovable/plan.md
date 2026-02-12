
# Implementar 3 Funcionalidades no Painel Admin

## 1. Configuracoes da Loja: Logo + Telefone/WhatsApp

### Problema atual
A aba "Configuracoes" so exibe Nome e Endereco, e o botao "Salvar" nao faz nada (apenas mostra toast).

### O que sera feito
- Adicionar campo de **upload de logo** com preview da imagem (usando o bucket `product-images` que ja existe)
- Adicionar campos editaveis de **Telefone** e **WhatsApp** (o WhatsApp e usado para receber pedidos)
- Fazer o botao "Salvar" realmente gravar as alteracoes no banco usando `useUpdateStore`

---

## 2. Dashboard com Filtro por Periodo (Dia / Mes / Ano)

### Problema atual
O dashboard mostra apenas "Faturamento Hoje" e pedidos recentes sem filtro.

### O que sera feito
- Adicionar seletor de periodo: **Hoje**, **Este Mes**, **Este Ano**, **Todos**
- Os 4 cards de estatisticas (Produtos, Pedidos, Pendentes, Faturamento) serao recalculados conforme o filtro selecionado
- A tabela de pedidos recentes tambem sera filtrada pelo periodo escolhido
- Ao abrir, exibe **Todos** por padrao

---

## 3. Login por Loja (Acesso Restrito ao Admin de Cada Loja)

### Problema atual
Qualquer pessoa pode acessar `/:slug/admin` sem autenticacao. Cada loja precisa de credenciais proprias.

### O que sera feito

**Banco de dados:**
- Criar tabela `store_admins` com colunas: `id`, `store_id`, `user_id` (referencia auth.users), `created_at`
- Politicas RLS para que apenas admins autenticados da loja possam acessar dados administrativos

**Cadastro de admins (no painel central `/admin`):**
- No card de cada empresa, adicionar opcao de cadastrar email/senha do admin da loja
- Ao cadastrar, cria o usuario via Supabase Auth e vincula na tabela `store_admins`

**Tela de login na loja:**
- Ao acessar `/:slug/admin`, se nao estiver logado como admin daquela loja, exibe tela de login
- Apos autenticar, verifica se o `user_id` esta vinculado ao `store_id` na tabela `store_admins`
- Se nao estiver vinculado, exibe mensagem de acesso negado

---

## Detalhes Tecnicos

### Arquivos a criar
- `src/hooks/useStoreAdmin.ts` -- hook para verificar se usuario e admin da loja
- `src/components/StoreAdminLogin.tsx` -- componente de login para o admin da loja

### Arquivos a modificar
- `src/pages/StoreAdminPage.tsx` -- aba Settings (logo, telefone, whatsapp, salvar real) + Dashboard (filtro periodo) + protecao de acesso
- `src/pages/AdminPage.tsx` -- adicionar opcao de cadastrar admin por loja
- `src/hooks/useStores.ts` -- sem alteracoes (ja tem useUpdateStore)
- `src/lib/storage.ts` -- reutilizar para upload de logo

### Migracao SQL
- Criar tabela `store_admins` com foreign key para `auth.users` e `stores`
- RLS policies para acesso restrito
- Funcao `is_store_admin(user_id, store_id)` como security definer para uso em RLS
