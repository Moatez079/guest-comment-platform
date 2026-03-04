
-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('system_owner', 'ship_owner', 'manager', 'reception');

-- Timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- SHIPS TABLE
CREATE TABLE public.ships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ships ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_ships_updated_at BEFORE UPDATE ON public.ships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PROFILES TABLE
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- USER ROLES TABLE
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  ship_id UUID REFERENCES public.ships(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, ship_id)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- SHIP MEMBERS TABLE
CREATE TABLE public.ship_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ship_id UUID NOT NULL REFERENCES public.ships(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ship_id, user_id)
);
ALTER TABLE public.ship_members ENABLE ROW LEVEL SECURITY;

-- FEEDBACK TABLE
CREATE TABLE public.feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ship_id UUID NOT NULL REFERENCES public.ships(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  ratings JSONB NOT NULL DEFAULT '{}',
  comments JSONB NOT NULL DEFAULT '{}',
  pdf_url TEXT,
  image_url TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_feedback_ship_id ON public.feedback(ship_id);
CREATE INDEX idx_feedback_submitted_at ON public.feedback(submitted_at DESC);

-- SECURITY DEFINER FUNCTIONS (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.has_ship_role(_user_id UUID, _role app_role, _ship_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role AND ship_id = _ship_id);
$$;

CREATE OR REPLACE FUNCTION public.is_ship_member(_user_id UUID, _ship_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ship_members WHERE user_id = _user_id AND ship_id = _ship_id);
$$;

-- RLS POLICIES: SHIPS
CREATE POLICY "System owners can manage all ships" ON public.ships FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'system_owner')) WITH CHECK (public.has_role(auth.uid(), 'system_owner'));
CREATE POLICY "Ship members can view their ship" ON public.ships FOR SELECT TO authenticated
  USING (public.is_ship_member(auth.uid(), id));

-- RLS POLICIES: PROFILES
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System owners can view all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'system_owner'));

-- RLS POLICIES: USER ROLES
CREATE POLICY "System owners manage all roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'system_owner')) WITH CHECK (public.has_role(auth.uid(), 'system_owner'));
CREATE POLICY "Ship owners can view roles for their ship" ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_ship_role(auth.uid(), 'ship_owner', ship_id));
CREATE POLICY "Ship owners can insert roles for their ship" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_ship_role(auth.uid(), 'ship_owner', ship_id) AND role IN ('manager', 'reception'));
CREATE POLICY "Ship owners can delete roles for their ship" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_ship_role(auth.uid(), 'ship_owner', ship_id) AND role IN ('manager', 'reception'));

-- RLS POLICIES: SHIP MEMBERS
CREATE POLICY "System owners manage all members" ON public.ship_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'system_owner')) WITH CHECK (public.has_role(auth.uid(), 'system_owner'));
CREATE POLICY "Ship owners can manage members" ON public.ship_members FOR ALL TO authenticated
  USING (public.has_ship_role(auth.uid(), 'ship_owner', ship_id)) WITH CHECK (public.has_ship_role(auth.uid(), 'ship_owner', ship_id));
CREATE POLICY "Members can view own membership" ON public.ship_members FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- RLS POLICIES: FEEDBACK
CREATE POLICY "Ship members can view feedback" ON public.feedback FOR SELECT TO authenticated
  USING (public.is_ship_member(auth.uid(), ship_id));
CREATE POLICY "System owners can manage all feedback" ON public.feedback FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'system_owner')) WITH CHECK (public.has_role(auth.uid(), 'system_owner'));
CREATE POLICY "Ship owners and managers can delete feedback" ON public.feedback FOR DELETE TO authenticated
  USING (public.has_ship_role(auth.uid(), 'ship_owner', ship_id) OR public.has_ship_role(auth.uid(), 'manager', ship_id));
CREATE POLICY "Anyone can submit feedback" ON public.feedback FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Authenticated can submit feedback" ON public.feedback FOR INSERT TO authenticated WITH CHECK (true);

-- STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public) VALUES ('feedback-files', 'feedback-files', false);
CREATE POLICY "Ship members can view feedback files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'feedback-files');
CREATE POLICY "Anyone can upload feedback files" ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'feedback-files');
CREATE POLICY "Authenticated can upload feedback files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feedback-files');
CREATE POLICY "Ship owners can delete feedback files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'feedback-files');
