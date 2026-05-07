
-- Restrict coupons read access to store admins / platform admins only
DROP POLICY IF EXISTS "Public read coupons" ON public.coupons;

CREATE POLICY "Admins can read coupons"
  ON public.coupons FOR SELECT
  USING (
    public.is_store_admin(auth.uid(), store_id)
    OR public.is_platform_admin(auth.uid())
  );

-- Server-side coupon validation function (no full coupon enumeration)
CREATE OR REPLACE FUNCTION public.validate_coupon(
  _store_id UUID,
  _code TEXT,
  _subtotal NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon public.coupons;
  v_discount NUMERIC := 0;
BEGIN
  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE store_id = _store_id
    AND UPPER(code) = UPPER(_code)
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid');
  END IF;

  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < NOW() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;

  IF v_coupon.max_uses IS NOT NULL AND v_coupon.used_count >= v_coupon.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'exhausted');
  END IF;

  IF _subtotal < COALESCE(v_coupon.min_order_value, 0) THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'min_order',
      'minOrderValue', v_coupon.min_order_value
    );
  END IF;

  IF v_coupon.discount_percent IS NOT NULL AND v_coupon.discount_percent > 0 THEN
    v_discount := ROUND((_subtotal * v_coupon.discount_percent / 100)::numeric, 2);
  ELSIF v_coupon.discount_value IS NOT NULL THEN
    v_discount := v_coupon.discount_value;
  END IF;

  IF v_discount > _subtotal THEN
    v_discount := _subtotal;
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'code', v_coupon.code,
    'discount', v_discount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_coupon(UUID, TEXT, NUMERIC) TO anon, authenticated;
