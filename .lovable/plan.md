## Diagnóstico

Encontrei o ponto do problema na DICOLORE:

- Existem **dois cadastros do mesmo cliente** com o mesmo telefone **(47) 99918-2612**.
- Um cadastro está **incompleto**, sem `customer_code`, sem `seller_code` e sem `cpf_cnpj`, mas ligado a um usuário que já fez login.
- O outro cadastro está **completo**, com:
  - `customer_code = 97761`
  - `seller_code = 179`
  - `cpf_cnpj = 028.359.259-10`
- O XML exportado usa o CPF/CNPJ vindo do pedido/perfil vinculado naquele momento. Quando o pedido fica associado ao cadastro incompleto, o XML sai com:
  - `<cgcCliente></cgcCliente>`
- Isso explica por que o sistema externo agora reclama de CPF/CNPJ, mesmo existindo um cadastro completo para a mesma cliente.

## O que vou implementar

### 1. Criar uma regra de reconciliação por telefone
- Normalizar o telefone para comparar só números.
- Sempre que houver dois cadastros do mesmo cliente na mesma loja, usar como **cadastro base** o que tiver:
  - `customer_code`
  - `seller_code`
  - `cpf_cnpj`
- Completar o cadastro incompleto com os dados do cadastro base.

### 2. Ajustar a importação/atualização de clientes
- Na importação da planilha, além de procurar por `customer_code` e `cpf_cnpj`, procurar também por **telefone**.
- Se encontrar um cadastro já existente pelo telefone:
  - reaproveitar esse cadastro em vez de criar outro duplicado;
  - copiar nele os dados do cadastro ERP (`customer_code`, `seller_code`, `cpf_cnpj` e demais campos faltantes);
  - priorizar os dados do cadastro que veio da planilha quando ele tiver código/vendedor.

### 3. Ajustar o vínculo do cliente que se cadastrou “fora do código”
- No fluxo em que o cliente entra com email/senha comum e preenche perfil, reconciliar com o cadastro ERP já existente pelo telefone.
- Se existir cadastro completo com código/vendedor para aquele telefone, ele passa a ser o cadastro canônico daquele cliente.
- O objetivo é evitar que o cliente continue com dois perfis paralelos.

### 4. Garantir que o XML use o cadastro reconciliado
- Na exportação do XML do pedido, buscar o CPF/CNPJ e código do vendedor a partir do **cadastro consolidado** do cliente.
- Assim, mesmo que o pedido tenha sido iniciado a partir do login “fora do código”, o XML final sai com os dados corretos.

### 5. Corrigir os duplicados já existentes na DICOLORE
- Aplicar um ajuste de dados para casos já criados, começando pelo cliente **97761 / ROSANI APARECIDA CANDIDO DE SOUZA ARNDT**.
- Regra do acerto:
  - manter como referência o cadastro que tiver `customer_code` / `seller_code`;
  - preencher o outro com os dados faltantes;
  - evitar que novos pedidos continuem usando o perfil incompleto.

## Resultado esperado

Depois desse ajuste:

- o cliente poderá continuar usando o acesso dele;
- o sistema deixará de separar o mesmo cliente em dois cadastros por causa do tipo de login;
- o XML passará a levar o **CPF/CNPJ correto**;
- o cadastro com **código/vendedor** será a fonte principal dos dados.

## Detalhes técnicos

- **Sem mudança de schema** do banco: o problema é de regra de reconciliação e de dados duplicados.
- Vou alterar a lógica em pontos já existentes, principalmente:
  - `supabase/functions/import-customers/index.ts`
  - `src/hooks/useCustomerProfile.ts`
  - ponto de exportação do XML / preenchimento de dados do cliente no admin
- Também vou aplicar um **ajuste nos dados existentes** da DICOLORE para não corrigir só os casos novos.
