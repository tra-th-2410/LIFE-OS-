/* Secure immediate student onboarding */

ALTER TABLE public.student_verifications
  ADD COLUMN IF NOT EXISTS education_level text;

UPDATE storage.buckets
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
WHERE id = 'student-verification';

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id AND coalesce(verification_status, 'basic') = 'basic');

REVOKE UPDATE ON TABLE public.profiles FROM authenticated;
GRANT UPDATE (
  username, full_name, avatar_url, bio, interests, skills, goals,
  profile_visibility, date_of_birth, country, province
) ON TABLE public.profiles TO authenticated;

REVOKE INSERT, UPDATE ON TABLE public.student_verifications FROM authenticated;

CREATE OR REPLACE FUNCTION public.complete_student_onboarding(
  p_education_level text,
  p_school_name text,
  p_grade_or_year text,
  p_student_id_path text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_file_exists boolean := false;
  v_mime_type text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_education_level NOT IN ('high_school', 'university') THEN
    RAISE EXCEPTION 'Invalid education level';
  END IF;

  IF length(trim(coalesce(p_school_name, ''))) < 2
     OR length(trim(p_school_name)) > 200
     OR length(trim(coalesce(p_grade_or_year, ''))) < 1
     OR length(trim(p_grade_or_year)) > 80 THEN
    RAISE EXCEPTION 'School and grade or year are required';
  END IF;

  IF p_student_id_path IS NULL
     OR p_student_id_path NOT LIKE v_user_id::text || '/%'
     OR p_student_id_path LIKE '%..%' THEN
    RAISE EXCEPTION 'Invalid student ID upload';
  END IF;

  SELECT true, metadata->>'mimetype'
  INTO v_file_exists, v_mime_type
  FROM storage.objects
  WHERE bucket_id = 'student-verification'
    AND name = p_student_id_path
    AND owner_id = v_user_id;

  IF NOT v_file_exists OR v_mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp') THEN
    RAISE EXCEPTION 'A valid student ID image is required';
  END IF;

  INSERT INTO public.student_verifications (
    user_id, status, method, school_name, grade_or_year,
    education_level, student_id_url
  ) VALUES (
    v_user_id, 'approved', 'student_id', trim(p_school_name),
    trim(p_grade_or_year), p_education_level, p_student_id_path
  );

  UPDATE public.profiles
  SET verification_status = 'verified', updated_at = now()
  WHERE id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_student_onboarding(text, text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_student_onboarding(text, text, text, text) FROM anon;