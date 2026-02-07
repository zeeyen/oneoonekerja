
-- =============================================
-- Fix 1: Tighten applicants RLS policies
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view all users" ON public.applicants;
DROP POLICY IF EXISTS "Authenticated users can insert users" ON public.applicants;
DROP POLICY IF EXISTS "Authenticated users can update users" ON public.applicants;
DROP POLICY IF EXISTS "Authenticated users can delete users" ON public.applicants;

CREATE POLICY "Dashboard users can view applicants"
  ON public.applicants FOR SELECT
  TO authenticated
  USING (has_dashboard_access(auth.uid()));

CREATE POLICY "Dashboard users can insert applicants"
  ON public.applicants FOR INSERT
  TO authenticated
  WITH CHECK (has_dashboard_access(auth.uid()));

CREATE POLICY "Dashboard users can update applicants"
  ON public.applicants FOR UPDATE
  TO authenticated
  USING (has_dashboard_access(auth.uid()))
  WITH CHECK (has_dashboard_access(auth.uid()));

CREATE POLICY "Admins can delete applicants"
  ON public.applicants FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- =============================================
-- Fix 2: Enable RLS on job_selections + policies
-- =============================================
ALTER TABLE public.job_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dashboard users can view job_selections"
  ON public.job_selections FOR SELECT
  TO authenticated
  USING (has_dashboard_access(auth.uid()));

CREATE POLICY "Dashboard users can insert job_selections"
  ON public.job_selections FOR INSERT
  TO authenticated
  WITH CHECK (has_dashboard_access(auth.uid()));

CREATE POLICY "Dashboard users can update job_selections"
  ON public.job_selections FOR UPDATE
  TO authenticated
  USING (has_dashboard_access(auth.uid()))
  WITH CHECK (has_dashboard_access(auth.uid()));

CREATE POLICY "Admins can delete job_selections"
  ON public.job_selections FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- =============================================
-- Fix 3: Enable RLS on jobs + policies
-- =============================================
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dashboard users can view jobs"
  ON public.jobs FOR SELECT
  TO authenticated
  USING (has_dashboard_access(auth.uid()));

CREATE POLICY "Dashboard users can insert jobs"
  ON public.jobs FOR INSERT
  TO authenticated
  WITH CHECK (has_dashboard_access(auth.uid()));

CREATE POLICY "Dashboard users can update jobs"
  ON public.jobs FOR UPDATE
  TO authenticated
  USING (has_dashboard_access(auth.uid()))
  WITH CHECK (has_dashboard_access(auth.uid()));

CREATE POLICY "Admins can delete jobs"
  ON public.jobs FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- =============================================
-- Fix 4: Enable RLS on malaysia_locations + policies
-- =============================================
ALTER TABLE public.malaysia_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dashboard users can view locations"
  ON public.malaysia_locations FOR SELECT
  TO authenticated
  USING (has_dashboard_access(auth.uid()));
