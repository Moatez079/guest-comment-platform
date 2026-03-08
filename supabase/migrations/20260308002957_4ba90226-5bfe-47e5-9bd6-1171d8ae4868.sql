
-- 1. Create helper function to check if user is approved
CREATE OR REPLACE FUNCTION public.is_approved_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND status = 'approved'
  )
  OR public.has_role(_user_id, 'system_owner')
$$;

-- 2. Fix profile self-approval: restrict users from changing their own status
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND status = (SELECT p.status FROM public.profiles p WHERE p.user_id = auth.uid())
  );

-- 3. Enforce approved status in feedback SELECT policy
DROP POLICY IF EXISTS "Ship members can view feedback" ON public.feedback;
CREATE POLICY "Ship members can view feedback" ON public.feedback
  FOR SELECT TO authenticated
  USING (
    is_ship_member(auth.uid(), ship_id)
    AND is_approved_user(auth.uid())
  );

-- 4. Enforce approved status in ships SELECT policy
DROP POLICY IF EXISTS "Ship members can view their ship" ON public.ships;
CREATE POLICY "Ship members can view their ship" ON public.ships
  FOR SELECT TO authenticated
  USING (
    is_ship_member(auth.uid(), id)
    AND is_approved_user(auth.uid())
  );

-- 5. Fix storage cross-ship access
DROP POLICY IF EXISTS "Ship members can view feedback files" ON storage.objects;
CREATE POLICY "Ship members can view own ship files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'feedback-files'
    AND (
      public.has_role(auth.uid(), 'system_owner')
      OR public.is_ship_member(
        auth.uid(),
        (storage.foldername(name))[1]::uuid
      )
    )
  );
