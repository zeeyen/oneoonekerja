-- =============================================
-- 101Kerja: Job Matches Table
-- Run this in Supabase SQL Editor
-- =============================================

-- Create the job_matches table for tracking job recommendations
CREATE TABLE public.job_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  user_id UUID NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  
  -- Match Details
  match_score DECIMAL(5,2) CHECK (match_score >= 0 AND match_score <= 100),
  match_reasons JSONB DEFAULT '[]',
  
  -- Status Tracking
  status TEXT DEFAULT 'presented' CHECK (status IN ('presented', 'accepted', 'rejected', 'expired')),
  rejection_reason TEXT,
  
  -- Timestamps
  presented_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Prevent duplicate matches
  UNIQUE(user_id, job_id)
);

-- Create indexes for common queries
CREATE INDEX idx_job_matches_user_id ON public.job_matches(user_id);
CREATE INDEX idx_job_matches_job_id ON public.job_matches(job_id);
CREATE INDEX idx_job_matches_status ON public.job_matches(status);

-- Enable Row Level Security
ALTER TABLE public.job_matches ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow all operations for authenticated users
CREATE POLICY "Authenticated users can view all job_matches"
  ON public.job_matches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert job_matches"
  ON public.job_matches FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update job_matches"
  ON public.job_matches FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete job_matches"
  ON public.job_matches FOR DELETE
  TO authenticated
  USING (true);

-- Add table comment
COMMENT ON TABLE public.job_matches IS 'Tracks job recommendations sent to users and their responses';
