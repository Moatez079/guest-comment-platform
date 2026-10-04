DROP POLICY IF EXISTS "Ship owners can insert roles for their ship" ON public.user_roles;
CREATE POLICY "Ship owners can insert roles for their ship" ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (has_ship_role(auth.uid(), 'ship_owner'::app_role, ship_id) AND role = ANY (ARRAY['manager'::app_role,'reception'::app_role,'viewer'::app_role]));
DROP POLICY IF EXISTS "Ship owners can delete roles for their ship" ON public.user_roles;
CREATE POLICY "Ship owners can delete roles for their ship" ON public.user_roles FOR DELETE TO authenticated
USING (has_ship_role(auth.uid(), 'ship_owner'::app_role, ship_id) AND role = ANY (ARRAY['manager'::app_role,'reception'::app_role,'viewer'::app_role]));