## Objetivo

Permitir que o admin da loja DICOLORE importe uma planilha com clientes do ERP. Cada linha gera automaticamente:
- Um perfil completo em `customer_profiles` (nome, CPF/CNPJ, WhatsApp, endereço, vendedor)
- Um usuário no Auth com **login = código ERP** e **senha = código ERP**

O cliente recebe apenas o código e entra direto, sem cadastro, sem confirmação de email, sem preencher endereço.

## Como o login vai funcionar

Como o Supabase Auth exige um identificador único (email), vamos converter o código ERP num email fictício internamente, transparente para o cliente:

- Cliente digita: **código `96133`** + senha **`96133`**
- Sistema converte para: `96133@dicolore.cliente.local` + senha `96133`
- Faz `signInWithPassword` normalmente

A tela de login mostra apenas dois campos: **"Código de cliente"** e **"Senha"**. Nenhuma menção a email.

Senhas curtas (< 6 chars) recebem padding automático — ex: código `123` vira senha `dico123` (mantendo a regra de 6 caracteres do Supabase).

## Fluxo de importação (admin)

1. Admin acessa **Configurações Gerais → Clientes → Importar planilha**
2. Faz upload do arquivo `.xlsx` (modelo fornecido com botão "Baixar modelo")
3. Tela de pré-visualização mostra:
   - Total de linhas
   - Quantos serão criados / atualizados (match por código ERP)
   - Quantos têm erro (CPF inválido, código duplicado, vendedor inexistente)
4. Botão **"Confirmar importação"** dispara processamento em lote
5. Ao final: relatório com sucessos, falhas e link para baixar planilha de **credenciais** (código + senha de cada cliente, para envio em massa via WhatsApp/email pelo admin)

## Modelo da planilha (colunas)

```text
codigo | nome | cpf_cnpj | whatsapp | cep | uf | cidade | bairro | endereco | numero | complemento | codigo_vendedor
```

- `codigo` é a chave única (será o login do cliente). Obrigatório.
- `codigo_vendedor` deve bater com a coluna **Código** já existente em `store_sellers`.
- Demais campos podem vir vazios — só `codigo` e `nome` são obrigatórios.

## Banco de dados

**Nova coluna em `customer_profiles`:**
- `customer_code TEXT` — armazena o código ERP. Index único `(store_id, customer_code) WHERE customer_code <> ''` para permitir upsert por código.

**Configuração Auth:** auto-confirm já está ativo, HIBP já desativado. Sem mudanças.

## Arquivos a criar / alterar

### Novo: `supabase/functions/import-customers/index.ts`
Edge Function com `service_role` que recebe `{ storeId, rows[] }` e para cada linha:
1. Valida campos obrigatórios
2. Gera email fictício: `${codigo}@${slug}.cliente.local`
3. Gera senha: `codigo` (ou `dico${codigo}` se < 6 chars)
4. `auth.admin.createUser({ email, password, email_confirm: true })` — se já existir, apenas atualiza profile
5. Faz upsert em `customer_profiles` com `user_id` retornado, vinculando todos os campos
6. Retorna por linha: `{ codigo, status: 'created'|'updated'|'error', erro?, senha }`

Apenas `store_admin` da loja pode invocar (valida JWT do chamador).

### Novo: `src/components/ImportCustomersDialog.tsx`
Dialog com:
- Botão "Baixar modelo" (gera .xlsx com cabeçalho + linha exemplo via SheetJS)
- Input de upload
- Tabela de pré-visualização (primeiras 20 linhas + contadores)
- Botão "Confirmar"
- Tela final com relatório + botão "Baixar credenciais.xlsx"

Usa biblioteca `xlsx` (SheetJS) — já leve, client-side.

### Alterar: `src/components/CustomerAuthDialog.tsx`
Adicionar nova aba/botão **"Entrar com código de cliente"** ao lado de Email/Senha (só aparece para lojas com flag `usa_codigo_cliente` em `stores.settings`, default true para Dicolore).

Internamente: monta `email = ${codigo}@${slug}.cliente.local` e chama `signInWithPassword`.

Se o login falhar, mensagem amigável: *"Código ou senha incorretos. Confira com o seu representante."*

### Alterar: `src/pages/StoreAdminPage.tsx`
Botão **"Importar clientes"** na aba Clientes, abre o `ImportCustomersDialog`.

### Alterar: `src/hooks/useCustomerProfiles.ts`
Incluir `customerCode` no mapeamento e nos hooks de criação/edição manual (para edição também aceitar editar o código).

## Fora do escopo

- Não muda fluxo de cadastro normal por email (continua disponível para outras lojas).
- Não força troca de senha no 1º acesso (conforme decidido).
- Não envia mensagens automáticas — admin baixa a planilha de credenciais e distribui manualmente.
- Edição em massa pós-importação fica para iteração futura (por ora: reimportar a planilha atualiza o que mudou via match por `codigo`).

## Capacidade

Postgres aguenta tranquilamente centenas de milhares de clientes. A importação é processada em lotes de 50 linhas na Edge Function para evitar timeout (limite de 60s por invocação). Para 5.000 clientes, ~100 invocações em paralelo concluem em segundos.
