-- =============================================
-- 101Kerja: Handovers Table (Candidate Verification)
-- Run this in Supabase SQL Editor
-- This is the core table for staff verification workflow
-- =============================================

-- Create the handovers table for tracking candidate handoffs to recruiters
CREATE TABLE public.handovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  job_match_id UUID REFERENCES public.job_matches(id) ON DELETE SET NULL,
  
  -- Verification Token
  eligibility_token TEXT UNIQUE NOT NULL, -- 8-char code like "ABC12345"
  whatsapp_group_link TEXT NOT NULL,
  
  -- Pipeline Status
  status TEXT DEFAULT 'pending_verification' CHECK (status IN (
    'pending_verification',
    'verified',
    'approved',
    'rejected',
    'interview_scheduled',
    'interviewed',
    'offer_made',
    'hired',
    'started_work',
    'dropped_out'
  )),
  
  -- Verification Details
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  staff_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_handovers_eligibility_token ON public.handovers(eligibility_token);
CREATE INDEX idx_handovers_status ON public.handovers(status);
CREATE INDEX idx_handovers_user_id ON public.handovers(user_id);

-- Enable Row Level Security
ALTER TABLE public.handovers ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow all operations for authenticated users
CREATE POLICY "Authenticated users can view all handovers"
  ON public.handovers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert handovers"
  ON public.handovers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update handovers"
  ON public.handovers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete handovers"
  ON public.handovers FOR DELETE
  TO authenticated
  USING (true);

-- Trigger for auto-updating updated_at (reuses existing function)
CREATE TRIGGER set_handovers_updated_at
  BEFORE UPDATE ON public.handovers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add table comment
COMMENT ON TABLE public.handovers IS 'Tracks candidate handoffs to recruiters with eligibility token verification';
