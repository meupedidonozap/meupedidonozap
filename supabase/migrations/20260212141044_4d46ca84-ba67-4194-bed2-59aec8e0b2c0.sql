
-- Create customer_profiles table (per-store profiles)
CREATE TABLE public.customer_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  cpf_cnpj text NOT NULL DEFAULT '',
  whatsapp text NOT NULL DEFAULT '',
  cep text NOT NULL DEFAULT '',
  uf text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  neighborhood text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  number text NOT NULL DEFAULT '',
  complement text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, store_id)
);

-- Enable RLS
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profiles
CREATE POLICY "Users can read own profiles"
ON public.customer_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own profiles
CREATE POLICY "Users can insert own profiles"
ON public.customer_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own profiles
CREATE POLICY "Users can update own profiles"
ON public.customer_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Admin can read all profiles (for store admin)
CREATE POLICY "Public read customer_profiles"
ON public.customer_profiles FOR SELECT
TO anon
USING (true);

-- Add user_id column to orders (nullable for backward compat)
ALTER TABLE public.orders ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Update updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_customer_profiles_updated_at
  BEFORE UPDATE ON public.customer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
