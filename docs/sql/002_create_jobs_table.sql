-- =============================================
-- 101Kerja: Job Listings Table
-- Run this in Supabase SQL Editor
-- =============================================

-- Create the jobs table for job listings
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- External Reference
  external_job_id INTEGER UNIQUE,
  
  -- Job Details
  job_title TEXT NOT NULL,
  position TEXT NOT NULL,
  job_type INTEGER CHECK (job_type IN (1, 2)), -- 1 = part_time, 2 = full_time
  
  -- Branch/Location
  branch_id INTEGER,
  branch_name TEXT,
  location_city TEXT,
  location_state TEXT,
  location_postcode TEXT,
  
  -- Requirements
  gender_requirement TEXT DEFAULT 'any' CHECK (gender_requirement IN ('male', 'female', 'any')),
  age_min INTEGER,
  age_max INTEGER,
  is_oku_friendly BOOLEAN DEFAULT false,
  
  -- Shift & Compensation
  num_shifts INTEGER,
  shift_details JSONB DEFAULT '{}',
  hourly_rate DECIMAL(10,2),
  
  -- Duration
  start_date DATE,
  end_date DATE,
  
  -- Communication
  whatsapp_group_link TEXT,
  
  -- Availability
  is_active BOOLEAN DEFAULT true,
  slots_available INTEGER DEFAULT 10,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_jobs_is_active ON public.jobs(is_active);
CREATE INDEX idx_jobs_location_state ON public.jobs(location_state);
CREATE INDEX idx_jobs_position ON public.jobs(position);
CREATE INDEX idx_jobs_job_type ON public.jobs(job_type);

-- Enable Row Level Security
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow read for authenticated users
CREATE POLICY "Authenticated users can view all jobs"
  ON public.jobs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert jobs"
  ON public.jobs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update jobs"
  ON public.jobs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete jobs"
  ON public.jobs FOR DELETE
  TO authenticated
  USING (true);

-- Trigger for auto-updating updated_at (reuses existing function)
CREATE TRIGGER set_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add table comment
COMMENT ON TABLE public.jobs IS 'Job listings for blue-collar gig positions';
