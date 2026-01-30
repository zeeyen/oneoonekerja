-- =============================================
-- 101Kerja: Job Seekers (users) Table
-- Run this in Supabase SQL Editor
-- =============================================

-- Create the users table for job seeker profiles
CREATE TABLE public.users (
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
CREATE INDEX idx_users_phone_number ON public.users(phone_number);
CREATE INDEX idx_users_is_active ON public.users(is_active);
CREATE INDEX idx_users_onboarding_status ON public.users(onboarding_status);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow all operations for authenticated users (admin dashboard)
CREATE POLICY "Authenticated users can view all users"
  ON public.users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert users"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update users"
  ON public.users FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete users"
  ON public.users FOR DELETE
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
CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add table comment
COMMENT ON TABLE public.users IS 'Job seeker profiles registered via WhatsApp chatbot';
