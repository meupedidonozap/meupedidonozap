

# Corrigir Fluxo de Login nos Paineis Admin

## Problema Real

O sistema compartilha uma unica sessao de autenticacao. Quando o usuario faz login no painel geral (`/admin`) como `meupedidonozap@gmail.com`, essa sessao permanece ativa ao visitar `/magui-papelaria/admin`. Como esse usuario nao e admin da loja Magui Papelaria, aparece "Acesso negado" sem opcao de sair ou trocar de conta.

## O que sera feito

### 1. Adicionar botao "Sair / Entrar com outra conta" na tela de "Acesso negado" do Store Admin

No arquivo `src/pages/StoreAdminPage.tsx`, a tela de "Acesso negado" (linhas 138-148) sera atualizada para incluir:
- Informacao de qual email esta logado no momento
- Botao "Sair e entrar com outra conta" que faz logout e recarrega a pagina, mostrando a tela de login
- Manter o botao "Ir para a Loja" existente

### 2. Adicionar botao de Logout no cabecalho do Store Admin

O cabecalho do painel da loja (linhas 220-238) nao tem botao de logout. Sera adicionado um botao "Sair" similar ao que ja existe no AdminPage.

### 3. Garantir que o `/admin` tambem funcione corretamente

O AdminPage.tsx ja tem o fluxo correto (login, acesso negado com logout, dashboard com logout). Verificar se esta publicado -- o usuario mencionou que a versao em producao nao esta funcionando, pode ser que falte publicar.

---

## Arquivos a modificar

| Arquivo | Alteracao |
|---|---|
| `src/pages/StoreAdminPage.tsx` | Adicionar logout na tela "Acesso negado" + botao Sair no cabecalho |

## Detalhes Tecnicos

### Tela "Acesso negado" atualizada

A tela passara a mostrar:
- Email atualmente logado (ex: "Logado como meupedidonozap@gmail.com")
- Botao "Sair e entrar com outra conta" que chama `signOut()` do hook `useAuth`
- Botao "Ir para a Loja" (ja existente)

### Cabecalho com Logout

Adicionar botao "Sair" no header do StoreAdminPage, ao lado do botao "Ver Loja", usando o mesmo padrao do AdminPage.

### Nota sobre Producao

As mudancas feitas anteriormente no AdminPage.tsx (protecao com login) precisam ser publicadas para funcionar em `meupedidonozap.online/admin`. Apos implementar essas correcoes, sera necessario clicar em "Publish" > "Update" para atualizar a versao de producao.

