CREATE POLICY "Anon can view ships for guest flow"
ON public.ships FOR SELECT
TO anon
USING (true);