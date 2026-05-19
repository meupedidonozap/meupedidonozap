## Diagnóstico

A infraestrutura já existe:

- Tabela `store_sellers` (código, nome, WhatsApp) com CRUD na aba de configurações da Dicolore (Vendedores WhatsApp).
- Diálogo "Editar Usuário" já tem o seletor "Códigos de Vendedor" que lê de `store_sellers`.
- Tabela de Clientes já mostra o nome do representante quando o `seller_code` bate com algum cadastro.

**Por que o seletor aparece vazio na tela do morgana:** os 14 representantes cadastrados estão todos com `code` em branco, e os clientes usam códigos numéricos (4, 21, 32, 45, 46, 53, 62, 68, 128, 179, 293, 306, 308). Sem código preenchido, o seletor filtra tudo e o vínculo com cliente/pedido não funciona.

## O que será feito

### 1) Preencher os códigos dos representantes existentes (Dicolore)

Atualizar `store_sellers` casando pelo nome (conforme imagem enviada):

```
Suelen → 179      Luciana → 4       Priscila → 53
Morgana → 68      Silvana → 308     Mari → 128
Rita → 46         Vanessa → 306     José Carlos → 45
Adriana → 293     Bety → 32         Ronaldo → 21
```

Criar o que falta:

- `Tatiana` (código 62) — está nos clientes mas não em `store_sellers`.

Os demais (Televendas Denise, Televendas Grazi) ficam sem código até o admin definir — aparecerão na lista do diálogo como "sem código".   
O TELEVENDAS Denis e TELEVENDAS Grazi, tem a possibilidade de ver os clientes dos vendedores que a ele estão vinculados.   
1 vendedor pode ver somente os seus clientes  
mas o Televendas pode ver todos os clientes dos vendedores que estão vinculadas a ela  
  
O perfil de usuario quando criado na plataforma, deve ter: Auxiliar / Vendedor / Televendas  
 *Auxiliar pode ver TODOS os clientes sem restrição*  
 *vendedor - poderá ver apenas os seus clientes*  
 * Televendas - poderá ver mais de um vendedor  
Desta forma, permitir na criação do usuario, colocar mais de um vendedor.

### 2) Melhorar o seletor "Códigos de Vendedor" do diálogo Editar Usuário

Hoje, vendedores sem código são silenciosamente ocultados. Vamos:

- Listar **todos** os representantes ativos, mostrando nome + código (ou aviso "sem código" desabilitado).
- Ordenar por nome.
- Manter o filtro por código/nome.

Assim o admin enxerga claramente quem ainda precisa receber um código.

### 3) Reforçar o CRUD de Representantes (aba já existente)

A aba "Vendedores (WhatsApp)" na configuração da Dicolore já permite criar, editar (código inline), ativar/desativar e remover. Vamos:

- Permitir editar também o **Nome** e o **WhatsApp** inline (hoje só o código é editável após criar).
- Garantir validação de código único por loja (avisar se duplicar).

### 4) Sem mudanças em RLS

As policies de `store_sellers` já permitem que o admin da loja gerencie tudo, e leitura pública dos ativos (necessário para o checkout).

## Arquivos afetados

- `src/components/StoreUsersTab.tsx` — listar todos os sellers (com indicação visual quando sem código).
- `src/pages/StoreAdminPage.tsx` — campos editáveis (nome/WhatsApp) na tabela de Vendedores + checagem de código duplicado.
- Migração de dados (via insert tool) para preencher os códigos dos 12 sellers e criar Tatiana.

## Fora do escopo

- Não vou alterar a estrutura de `customer_profiles` nem mexer na importação Excel.
- Não vou refazer a aba de Clientes, só a coluna Representante já resolve a exibição quando o código bate.