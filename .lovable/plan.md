## Objetivo

Permitir informar o **Código do Cliente** (o mesmo código do ERP) ao criar/editar um cliente no painel, e — ao criar com código — já gerar o acesso do cliente seguindo a regra existente: entra pela aba **Código**, usando o código como usuário e como senha.

## Como funciona hoje (verificado)

- A tabela `customer_profiles` já tem a coluna `customer_code`, e a lista de clientes já mostra a coluna "Código" — mas os diálogos "Novo Cliente" e "Editar Cliente" não têm esse campo.
- O login por código já existe (`CustomerAuthDialog`): converte o código em `codigo@slug.cliente.local` e faz login com a senha digitada.
- A função `import-customers` (modo `import`) já cria exatamente esse acesso: cria o usuário com e-mail `codigo@slug.cliente.local`, senha = código, e-mail confirmado, e vincula o `user_id` ao perfil.

## O que será feito

1. **Campo no formulário** (`src/pages/StoreAdminPage.tsx`)
   - Adicionar "Código do Cliente" nos diálogos Novo Cliente e Editar Cliente (ao lado de CPF/CNPJ), com dica: "Usado como login e senha inicial do cliente".
   - Incluir `customerCode` no estado `customerForm` e no preenchimento ao editar.

2. **Criação com código = cria acesso**
   - No botão Salvar do "Novo Cliente":
     - Sem código: mantém o comportamento atual (insert direto, sem conta de acesso).
     - Com código: valida que o código ainda não existe na loja; se existir, avisa e não duplica. Caso contrário, chama a função `import-customers` (modo `import`) com uma única linha contendo os dados do formulário, o que cria o perfil **e** a conta de acesso (login = código, senha = código).
   - Ao concluir, mostrar aviso com o código/senha inicial para repassar ao cliente e atualizar a lista.

3. **Edição**
   - Permitir preencher/corrigir o código de um cliente já existente (grava em `customer_code`, com validação de duplicidade na loja).
   - Se o cliente ainda não tiver conta de acesso e um código for informado na edição, oferecer a criação do acesso pelo mesmo caminho (mesma regra: senha = código). Se já tiver conta, o código só é atualizado no cadastro — a troca de senha continua pelo botão de chave já existente.

4. **Hooks** (`src/hooks/useCustomerProfiles.ts`)
   - Aceitar `customerCode` em criar/atualizar cliente, gravando na coluna `customer_code`.

## Detalhes técnicos

- Nenhuma migração de banco necessária: `customer_profiles.customer_code` já existe.
- Normalização do código: `trim`; o e-mail de acesso usa o mesmo saneamento já aplicado hoje (`minúsculas`, só letras/números), garantindo compatibilidade com a tela de login por código.
- Senha inicial precisa ter 6+ caracteres para o Auth; se o código for menor, será aplicado o mesmo tratamento já usado na importação (verificar `buildPassword` e reutilizá-lo — sem inventar regra nova).
- Reuso da edge function existente `import-customers`, sem criar nova função.
