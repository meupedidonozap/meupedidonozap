# Cadastro de vendedores na Dicolore SENSES

## Causa confirmada

O card "Vendedores (WhatsApp)" já existe no código para a SENSES, mas ele fica na aba **Configurações**, que só aparece para o **admin principal da loja**.

Consulta ao banco: a Dicolore SENSES tem **0 admins principais** cadastrados. Só existe 1 usuário na loja (`jorge@senses.com.br`, perfil "vendedor"), que não é admin. Por isso a aba Configurações — e com ela o cadastro de vendedores — não aparece.

A loja também tem **0 vendedores** cadastrados, o que explica o checkout ainda não mostrar a escolha de representante.

## O que fazer

1. **Definir o admin principal da SENSES**: cadastrar um administrador da loja (e-mail e senha) com acesso total ao painel. Com isso as abas Configurações, Usuários e Horários passam a aparecer, incluindo o card "Vendedores (WhatsApp)".
2. **Cadastrar os vendedores** da SENSES pelo card (nome, código, WhatsApp).
3. **Publicar** o app, para que a alteração já feita no painel também valhas no site publicado.

Alternativa, se preferir não criar um novo login: promover o usuário Jorge a admin principal da loja — ele passa a enxergar todo o painel da SENSES.

## Detalhes técnicos

- `src/pages/StoreAdminPage.tsx`: `usesSellerRule` (linha ~181) já inclui `dicoloresenses`; o card está dentro de `<TabsContent value="settings">`, cujo gatilho é condicionado a `isAdmin`.
- `isAdmin` vem de `store_admins` (via `is_store_admin`). A criação do admin é feita pela Edge Function `create-store-admin` (service_role), acionada pelo painel de superadmin em `/admin`.
- RLS de `store_sellers` já permite gestão por `is_store_admin(auth.uid(), store_id)` e leitura pública dos ativos — nenhuma alteração de banco é necessária.
- Nenhuma mudança de código é necessária, a menos que você queira liberar o card de vendedores também para usuários não-admin (não recomendado por segurança).