
-- Drop all existing RESTRICTIVE policies on profiles
DROP POLICY IF EXISTS "System owners can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "System owners can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "System owners can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Recreate as PERMISSIVE policies (default)
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "System owners can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'system_owner'));

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "System owners can update all profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'system_owner'))
WITH CHECK (public.has_role(auth.uid(), 'system_owner'));

CREATE POLICY "System owners can delete profiles"
ON public.profiles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'system_owner'));
