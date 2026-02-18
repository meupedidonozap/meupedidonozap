
# Segurança - Status Atual

## ✅ Concluído

- **RLS restritivo aplicado** em stores, categories, products, product_variants, food_items, coupons, store_admins e storage product-images
- **Security findings atualizados** - findings resolvidos removidos, baixo risco marcados adequadamente

## ⚠️ Pendente (requer ação do usuário)

- **Leaked Password Protection**: Configuração de Auth que precisa ser habilitada via Cloud View > Auth Settings

## ℹ️ Informativo (sem ação necessária)

- `is_store_admin_definer` - SECURITY DEFINER usado corretamente
- `stores_contact_info_exposure` - Dados de contato são públicos intencionalmente
- `admin_creation_enum` - Risco baixo, requer edge function para corrigir
- `coupon_no_server_validation` - Requer RPC/edge function dedicada
