
ALTER TABLE public.applicants
  DROP CONSTRAINT IF EXISTS users_onboarding_status_check;

ALTER TABLE public.applicants
  ADD CONSTRAINT users_onboarding_status_check
  CHECK (onboarding_status IN ('new', 'in_progress', 'completed', 'matching', 'follow_up'));
