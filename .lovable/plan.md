# Cadastro Completo + Busca de CEP no Checkout

## Resumo

Atualmente o cadastro de cliente pede apenas email e senha. O plano e expandir o formulario de cadastro para incluir todos os dados pessoais e de endereco, e adicionar busca automatica de endereco ao informar o CEP (via API publica ViaCEP).

---

## Mudancas

### 1. Expandir o formulario de cadastro (CustomerAuthDialog.tsx)

O dialog de cadastro tera duas etapas:

- **Etapa 1**: Email, Senha e Confirmar Senha
- **Etapa 2** (apos criar conta): Nome, WhatsApp, CEP (com busca automatica), UF, Cidade, Bairro, Endereco, Numero, Complemento

Ao completar a etapa 2, os dados sao salvos no `customer_profiles` usando `useUpsertCustomerProfile`. O dialog so fecha apos salvar o perfil completo.

O componente recebera o `storeId` como prop para vincular o perfil a loja.

### 2. Busca automatica de CEP (ViaCEP)

Ao digitar um CEP completo (8 digitos), o sistema consulta a API publica `https://viacep.com.br/ws/{cep}/json/` e preenche automaticamente:

- UF (estado)
- Cidade
- Bairro
- Endereco (logradouro)

Essa mesma funcionalidade sera adicionada tambem no formulario do checkout (CheckoutPage.tsx), para quando o usuario editar o CEP.

### 3. Fluxo do usuario

```text
Carrinho -> Checkout -> "Faca login para continuar"
                            |
                     [Entrar] ou [Cadastrar]
                            |
                   (Se cadastrar)
                            |
                     Etapa 1: Email + Senha
                            |
                     Etapa 2: Dados pessoais + Endereco
                       (CEP preenche automatico)
                            |
                     Perfil salvo -> Formulario preenchido
```

---

## Detalhes Tecnicos

### Arquivos modificados

1. `**src/components/CustomerAuthDialog.tsx**`
  - Adicionar prop `storeId: string`
  - Adicionar estado para etapa (step 1 = credenciais, step 2 = perfil)
  - Adicionar campos: name, whatsapp, cep, uf, city, neighborhood, address, number, complement
  - Apos `signUp` bem-sucedido, avancar para etapa 2
  - Na etapa 2, validar campos obrigatorios (name, whatsapp, uf, city, address) e chamar `useUpsertCustomerProfile`
  - Implementar funcao `fetchCep` que consulta ViaCEP e preenche os campos
2. `**src/pages/CheckoutPage.tsx**`
  - Passar `storeId` para o `CustomerAuthDialog`
  - Adicionar funcao `fetchCep` no campo CEP do formulario de endereco (mesma logica)
  - Quando o CEP tiver 8 digitos (sem hifen), buscar e preencher UF, Cidade, Bairro e Endereco

### Funcao de busca de CEP (reutilizavel)

Criar um utilitario em `src/lib/cepLookup.ts`:

```typescript
export async function fetchAddressByCep(cep: string) {
  const cleaned = cep.replace(/\D/g, '');
  if (cleaned.length !== 8) return null;
  const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
  const data = await res.json();
  if (data.erro) return null;
  return {
    uf: data.uf,
    city: data.localidade,
    neighborhood: data.bairro,
    address: data.logradouro,
  };
}
```

### Validacao no cadastro (etapa 2)

Campos obrigatorios: Nome, WhatsApp, UF, Cidade, Endereco. Os demais sao opcionais.  
O Usuario dentro da sua conta poderá:  
 *editar todo e qualquer campo do seu cadastro*

&nbsp;