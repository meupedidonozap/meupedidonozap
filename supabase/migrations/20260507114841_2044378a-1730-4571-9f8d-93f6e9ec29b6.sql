-- Drop FK constraint so we can use product.id as service_id
ALTER TABLE public.salon_service_professionals DROP CONSTRAINT IF EXISTS salon_service_professionals_service_id_fkey;
ALTER TABLE public.salon_appointments DROP CONSTRAINT IF EXISTS salon_appointments_service_id_fkey;

-- Replace RLS policies on salon_service_professionals to check via products OR salon_services
DROP POLICY IF EXISTS "Public read salon_service_professionals" ON public.salon_service_professionals;
DROP POLICY IF EXISTS "Store admins manage salon_service_professionals" ON public.salon_service_professionals;

CREATE POLICY "Public read salon_service_professionals"
  ON public.salon_service_professionals FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.products p JOIN public.stores s ON s.id = p.store_id
            WHERE p.id = salon_service_professionals.service_id AND s.is_active = true)
    OR EXISTS (SELECT 1 FROM public.salon_services sv JOIN public.stores s ON s.id = sv.store_id
               WHERE sv.id = salon_service_professionals.service_id AND s.is_active = true)
  );

CREATE POLICY "Store admins manage salon_service_professionals"
  ON public.salon_service_professionals FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.products p
            WHERE p.id = salon_service_professionals.service_id
              AND (is_store_admin(auth.uid(), p.store_id) OR is_platform_admin(auth.uid())))
    OR EXISTS (SELECT 1 FROM public.salon_services sv
               WHERE sv.id = salon_service_professionals.service_id
                 AND (is_store_admin(auth.uid(), sv.store_id) OR is_platform_admin(auth.uid())))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.products p
            WHERE p.id = salon_service_professionals.service_id
              AND (is_store_admin(auth.uid(), p.store_id) OR is_platform_admin(auth.uid())))
    OR EXISTS (SELECT 1 FROM public.salon_services sv
               WHERE sv.id = salon_service_professionals.service_id
                 AND (is_store_admin(auth.uid(), sv.store_id) OR is_platform_admin(auth.uid())))
  );