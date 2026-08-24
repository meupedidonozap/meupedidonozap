# Senha do cliente = código, mesmo com 5 dígitos

## Como está hoje

O padrão atual é: **login = código do cliente** e **senha = código do cliente**, mas só quando o código tem 6 ou mais caracteres. Para códigos curtos (como `98887`, 5 dígitos) o sistema grava a senha como `dico98887`, porque o serviço de autenticação exige no mínimo 6 caracteres.

Resultado: o cliente digita `98887` / `98887` na aba **Código/Usuário** e recebe "Código ou senha incorretos", exatamente o erro da tela enviada.

## O que muda

O cliente passa a usar sempre **código = senha**, com qualquer quantidade de dígitos. O complemento continua existindo internamente (invisível para o cliente e para o vendedor):

- Na tela de login por código, ao entrar, o sistema tenta a senha digitada e, se ela for curta, tenta automaticamente a mesma senha no formato interno. O cliente só digita `98887` nos dois campos.
- No cadastro de cliente pelo painel (Novo/Editar), quando a senha informada for igual ao código/usuário e tiver menos de 6 caracteres, o sistema aceita normalmente e faz o mesmo complemento por baixo, sem mais mensagem de erro de "mínimo 6".
- O toast de confirmação passa a mostrar ao vendedor exatamente o que informar ao cliente: `Login: 98887 · Senha: 98887`.
- Clientes já criados com o padrão antigo continuam entrando: a tentativa automática cobre os dois formatos.

## Detalhes técnicos

- `src/lib/customerAuth.ts` (novo): funções `buildCustomerEmail(codigo, slug)` e `buildCustomerPassword(valor)` — regra única (`len >= 6 ? valor : 'dico'+valor`) usada por front e admin.
- `src/components/CustomerAuthDialog.tsx` → `handleCodeLogin`: usa o helper; tenta `signIn` com a senha digitada e, em caso de falha e senha com menos de 6 caracteres, refaz com `buildCustomerPassword(senha)` antes de exibir erro.
- `src/pages/StoreAdminPage.tsx`: remove o bloqueio de "senha mínima 6" quando a senha é igual ao usuário/código; envia à função a senha já normalizada pelo helper; ajusta o texto de ajuda do bloco "Acesso do Cliente" e o toast final.
- `supabase/functions/import-customers/index.ts`: `buildPassword` continua igual; a validação `senhaRaw.length < 6` passa a aplicar o mesmo complemento em vez de rejeitar. Redeploy da função.
- Sem alteração de schema.
