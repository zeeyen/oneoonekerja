
-- Fix conversations table
DROP POLICY IF EXISTS "Authenticated users can view all conversations" ON public.conversations;
DROP POLICY IF EXISTS "Authenticated users can insert conversations" ON public.conversations;
DROP POLICY IF EXISTS "Authenticated users can update conversations" ON public.conversations;
DROP POLICY IF EXISTS "Authenticated users can delete conversations" ON public.conversations;

CREATE POLICY "Dashboard users can view conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (has_dashboard_access(auth.uid()));

CREATE POLICY "Dashboard users can insert conversations"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (has_dashboard_access(auth.uid()));

CREATE POLICY "Dashboard users can update conversations"
  ON public.conversations FOR UPDATE TO authenticated
  USING (has_dashboard_access(auth.uid()))
  WITH CHECK (has_dashboard_access(auth.uid()));

CREATE POLICY "Admins can delete conversations"
  ON public.conversations FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

-- Fix job_matches table
DROP POLICY IF EXISTS "Authenticated users can view all job_matches" ON public.job_matches;
DROP POLICY IF EXISTS "Authenticated users can insert job_matches" ON public.job_matches;
DROP POLICY IF EXISTS "Authenticated users can update job_matches" ON public.job_matches;
DROP POLICY IF EXISTS "Authenticated users can delete job_matches" ON public.job_matches;

CREATE POLICY "Dashboard users can view job_matches"
  ON public.job_matches FOR SELECT TO authenticated
  USING (has_dashboard_access(auth.uid()));

CREATE POLICY "Dashboard users can insert job_matches"
  ON public.job_matches FOR INSERT TO authenticated
  WITH CHECK (has_dashboard_access(auth.uid()));

CREATE POLICY "Dashboard users can update job_matches"
  ON public.job_matches FOR UPDATE TO authenticated
  USING (has_dashboard_access(auth.uid()))
  WITH CHECK (has_dashboard_access(auth.uid()));

CREATE POLICY "Admins can delete job_matches"
  ON public.job_matches FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

-- Fix admin_actions table
DROP POLICY IF EXISTS "Admins can manage admin_actions" ON public.admin_actions;

CREATE POLICY "Dashboard users can view admin_actions"
  ON public.admin_actions FOR SELECT TO authenticated
  USING (has_dashboard_access(auth.uid()));

CREATE POLICY "Dashboard users can insert admin_actions"
  ON public.admin_actions FOR INSERT TO authenticated
  WITH CHECK (has_dashboard_access(auth.uid()));

CREATE POLICY "Admins can update admin_actions"
  ON public.admin_actions FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete admin_actions"
  ON public.admin_actions FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));
