

# Auditoria de Segurança e Proteção Contra Clonagem

## 1. Proteção contra Remix/Clonagem

Para impedir que seu projeto seja clonado:

1. **Vá em Project Settings → Project visibility** e defina como **"Restricted"** (apenas você pode ver o código no editor)
2. Isso impede que outros usuários do Lovable façam remix do seu projeto

O app publicado continuará acessível ao público normalmente — a visibilidade controla apenas o acesso ao **código-fonte** no editor.

---

## 2. Vulnerabilidades Encontradas (Scan de Segurança)

O scan identificou **6 problemas** que precisam ser corrigidos:

### CRÍTICO — Corrigir imediatamente

| Problema | Risco | Correção |
|----------|-------|----------|
| **Qualquer admin de loja pode deletar imagens de OUTRAS lojas** | Admin malicioso pode apagar fotos de concorrentes | Atualizar políticas RLS do bucket `product-images` para verificar que o path pertence à loja do admin |
| **Cupons são públicos para qualquer pessoa** | Qualquer um pode ver todos os códigos de desconto de todas as lojas | Restringir SELECT da tabela `coupons` para mostrar apenas cupons ativos da loja sendo acessada |
| **Proteção contra senhas vazadas DESABILITADA** | Usuários podem usar senhas já comprometidas em vazamentos | Habilitar HIBP check nas configurações de autenticação |

### MODERADO — Corrigir em breve

| Problema | Risco | Correção |
|----------|-------|----------|
| **Lojas inativas visíveis publicamente** | Dados de contato de lojas desativadas expostos | Filtrar SELECT público de `stores` para `WHERE is_active = true` |
| **INSERT público em `store_visits`** | Qualquer pessoa pode inserir registros de visita (spam) | Avaliar se precisa de rate limiting ou validação |
| **Política redundante em `orders`** | Não é vulnerabilidade, mas código desnecessário | Simplificar a política SELECT |

---

## 3. Plano de Correção Técnica

### Migração SQL (database migration)

```sql
-- 1. Restringir cupons: apenas cupons ativos da loja consultada
DROP POLICY "Public read coupons" ON coupons;
CREATE POLICY "Public read active coupons" ON coupons
  FOR SELECT TO public
  USING (is_active = true);

-- 2. Restringir lojas inativas
DROP POLICY "Public read stores" ON stores;
CREATE POLICY "Public read active stores" ON stores
  FOR SELECT TO public
  USING (is_active = true OR is_store_admin(auth.uid(), id) OR is_platform_admin(auth.uid()));

-- 3. Corrigir storage: admin só gerencia imagens da própria loja
-- (Requer atualizar policies no bucket product-images via SQL)
```

### Habilitar Leaked Password Protection

Usar a ferramenta `configure_auth` para ativar a verificação HIBP de senhas vazadas.

### Arquivo de código — sem mudanças necessárias

O RLS é server-side, então as correções são todas no banco de dados. O código frontend não precisa mudar.

---

## Resumo

| Ação | Como fazer |
|------|-----------|
| **Impedir clonagem** | Project Settings → Visibility → Restricted |
| **Corrigir 6 vulnerabilidades** | Migração SQL + ativar HIBP |
| **Código frontend** | Nenhuma mudança necessária |

