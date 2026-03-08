
-- Fix storage upload policy: restrict path to valid UUID folder and PDF extension
DROP POLICY IF EXISTS "Anyone can upload feedback files" ON storage.objects;
CREATE POLICY "Anyone can upload feedback files" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'feedback-files'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND name ~ '\.pdf$'
  );

-- Also fix the authenticated upload policy if it exists
DROP POLICY IF EXISTS "Authenticated can upload feedback files" ON storage.objects;
CREATE POLICY "Authenticated can upload feedback files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'feedback-files'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND name ~ '\.pdf$'
  );

-- Fix feedback INSERT: add basic validation constraints via RLS
DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback;
CREATE POLICY "Anyone can submit feedback" ON public.feedback
  FOR INSERT TO anon
  WITH CHECK (
    ship_id IS NOT NULL
    AND room_number IS NOT NULL
    AND length(room_number) BETWEEN 1 AND 10
    AND room_number ~ '^[A-Za-z0-9 \-]{1,10}$'
  );

DROP POLICY IF EXISTS "Authenticated can submit feedback" ON public.feedback;
CREATE POLICY "Authenticated can submit feedback" ON public.feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    ship_id IS NOT NULL
    AND room_number IS NOT NULL
    AND length(room_number) BETWEEN 1 AND 10
    AND room_number ~ '^[A-Za-z0-9 \-]{1,10}$'
  );
