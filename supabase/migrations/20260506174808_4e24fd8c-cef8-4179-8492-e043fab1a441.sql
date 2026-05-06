
-- Required for EXCLUDE constraint with tstzrange overlap
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Professionals
CREATE TABLE public.salon_professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  photo_url text,
  bio text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_salon_professionals_store ON public.salon_professionals(store_id);

-- Services
CREATE TABLE public.salon_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  price numeric(10,2) NOT NULL DEFAULT 0,
  duration_minutes integer NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_salon_services_store ON public.salon_services(store_id);

-- Service ↔ Professionals
CREATE TABLE public.salon_service_professionals (
  service_id uuid NOT NULL REFERENCES public.salon_services(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.salon_professionals(id) ON DELETE CASCADE,
  PRIMARY KEY (service_id, professional_id)
);

-- Appointments
CREATE TABLE public.salon_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.salon_professionals(id) ON DELETE RESTRICT,
  service_id uuid REFERENCES public.salon_services(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_whatsapp text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'reservado' CHECK (status IN ('reservado','confirmado','concluido','cancelado')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salon_appointments_time_valid CHECK (ends_at > starts_at)
);
CREATE INDEX idx_salon_appointments_store ON public.salon_appointments(store_id);
CREATE INDEX idx_salon_appointments_prof_date ON public.salon_appointments(professional_id, starts_at);

-- Prevent overlapping appointments for the same professional (ignores cancelled)
ALTER TABLE public.salon_appointments
  ADD CONSTRAINT salon_appointments_no_overlap
  EXCLUDE USING gist (
    professional_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status <> 'cancelado');

-- updated_at triggers
CREATE TRIGGER trg_salon_professionals_updated BEFORE UPDATE ON public.salon_professionals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_salon_services_updated BEFORE UPDATE ON public.salon_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_salon_appointments_updated BEFORE UPDATE ON public.salon_appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.salon_professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_service_professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_appointments ENABLE ROW LEVEL SECURITY;

-- Public read of active professionals/services from active stores
CREATE POLICY "Public read salon_professionals"
  ON public.salon_professionals FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.is_active = true));

CREATE POLICY "Public read salon_services"
  ON public.salon_services FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.is_active = true));

CREATE POLICY "Public read salon_service_professionals"
  ON public.salon_service_professionals FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.salon_services sv
    JOIN public.stores s ON s.id = sv.store_id
    WHERE sv.id = service_id AND s.is_active = true
  ));

-- Public read of appointments needed so the booking UI can hide taken slots
CREATE POLICY "Public read salon_appointments"
  ON public.salon_appointments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.is_active = true));

-- Store admin / platform admin write policies (uses existing helpers)
-- salon_professionals
CREATE POLICY "Store admins manage salon_professionals"
  ON public.salon_professionals FOR ALL
  USING (public.is_store_admin(auth.uid(), store_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_store_admin(auth.uid(), store_id) OR public.is_platform_admin(auth.uid()));

-- salon_services
CREATE POLICY "Store admins manage salon_services"
  ON public.salon_services FOR ALL
  USING (public.is_store_admin(auth.uid(), store_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_store_admin(auth.uid(), store_id) OR public.is_platform_admin(auth.uid()));

-- salon_service_professionals
CREATE POLICY "Store admins manage salon_service_professionals"
  ON public.salon_service_professionals FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.salon_services sv
    WHERE sv.id = service_id
      AND (public.is_store_admin(auth.uid(), sv.store_id) OR public.is_platform_admin(auth.uid()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.salon_services sv
    WHERE sv.id = service_id
      AND (public.is_store_admin(auth.uid(), sv.store_id) OR public.is_platform_admin(auth.uid()))
  ));

-- salon_appointments: public can INSERT (clients booking from storefront)
CREATE POLICY "Public can create salon_appointments"
  ON public.salon_appointments FOR INSERT
  WITH CHECK (
    status = 'reservado'
    AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.is_active = true)
  );

-- Store admins can update / delete
CREATE POLICY "Store admins update salon_appointments"
  ON public.salon_appointments FOR UPDATE
  USING (public.is_store_admin(auth.uid(), store_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_store_admin(auth.uid(), store_id) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Store admins delete salon_appointments"
  ON public.salon_appointments FOR DELETE
  USING (public.is_store_admin(auth.uid(), store_id) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Store admins insert salon_appointments"
  ON public.salon_appointments FOR INSERT
  WITH CHECK (public.is_store_admin(auth.uid(), store_id) OR public.is_platform_admin(auth.uid()));
