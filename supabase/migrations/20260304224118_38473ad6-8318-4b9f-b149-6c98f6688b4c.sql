
-- Add status column to profiles
ALTER TABLE public.profiles ADD COLUMN status text NOT NULL DEFAULT 'pending';

-- Update existing profiles to approved (so current users aren't locked out)
UPDATE public.profiles SET status = 'approved';

-- Allow system owners to update any profile (for approval/suspension)
CREATE POLICY "System owners can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'system_owner'::app_role))
WITH CHECK (has_role(auth.uid(), 'system_owner'::app_role));

-- Allow system owners to delete profiles
CREATE POLICY "System owners can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'system_owner'::app_role));
