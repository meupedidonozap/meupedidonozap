ALTER TABLE public.salon_service_professionals
  ADD CONSTRAINT salon_service_professionals_service_id_products_fkey
  FOREIGN KEY (service_id) REFERENCES public.products(id) ON DELETE CASCADE
  NOT VALID;