-- =============================================
-- 101Kerja: Job Seekers (applicants) Table
-- Run this in Supabase SQL Editor
-- =============================================

-- Create the applicants table for job seeker profiles
CREATE TABLE public.applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Contact & Identity
  phone_number TEXT UNIQUE NOT NULL,
  ic_number TEXT UNIQUE,
  full_name TEXT,
  age INTEGER,
  gender TEXT CHECK (gender IN ('male', 'female')),
  
  -- Language & Location
  preferred_language TEXT DEFAULT 'ms' CHECK (preferred_language IN ('ms', 'en', 'zh')),
  location_city TEXT,
  location_state TEXT,
  location_postcode TEXT,
  
  -- Job Preferences
  preferred_job_types TEXT[] DEFAULT '{}',
  preferred_positions TEXT[] DEFAULT '{}',
  years_experience INTEGER DEFAULT 0,
  
  -- Transport & Accessibility
  has_transport BOOLEAN DEFAULT false,
  transport_type TEXT,
  is_oku BOOLEAN DEFAULT false,
  
  -- Availability Schedule
  availability JSONB DEFAULT '{}',
  
  -- Onboarding State (for WhatsApp bot)
  onboarding_status TEXT DEFAULT 'new' CHECK (onboarding_status IN ('new', 'in_progress', 'completed')),
  onboarding_step TEXT,
  conversation_state JSONB DEFAULT '{}',
  
  -- Status & Timestamps
  is_active BOOLEAN DEFAULT true,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_applicants_phone_number ON public.applicants(phone_number);
CREATE INDEX idx_applicants_is_active ON public.applicants(is_active);
CREATE INDEX idx_applicants_onboarding_status ON public.applicants(onboarding_status);

-- Enable Row Level Security
ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow all operations for authenticated users (admin dashboard)
CREATE POLICY "Authenticated users can view all applicants"
  ON public.applicants FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert applicants"
  ON public.applicants FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update applicants"
  ON public.applicants FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete applicants"
  ON public.applicants FOR DELETE
  TO authenticated
  USING (true);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating updated_at
CREATE TRIGGER set_applicants_updated_at
  BEFORE UPDATE ON public.applicants
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add table comment
COMMENT ON TABLE public.applicants IS 'Job seeker profiles registered via WhatsApp chatbot';
