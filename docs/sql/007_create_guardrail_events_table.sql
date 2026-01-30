-- =============================================
-- 101Kerja: Guardrail Events Table (Moderation Tracking)
-- Run this in Supabase SQL Editor
-- =============================================

-- Create the guardrail_events table for tracking moderation events
CREATE TABLE public.guardrail_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User Reference
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Event Details
  event_type TEXT NOT NULL CHECK (event_type IN ('deviation', 'vulgar', 'spam')),
  message_content TEXT,
  warning_count INTEGER DEFAULT 1,
  action_taken TEXT CHECK (action_taken IN ('warning', 'timeout', 'none')),
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_guardrail_events_user_id ON public.guardrail_events(user_id);
CREATE INDEX idx_guardrail_events_event_type ON public.guardrail_events(event_type);
CREATE INDEX idx_guardrail_events_created_at ON public.guardrail_events(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.guardrail_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow all operations for authenticated users
CREATE POLICY "Authenticated users can view all guardrail_events"
  ON public.guardrail_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert guardrail_events"
  ON public.guardrail_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update guardrail_events"
  ON public.guardrail_events FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete guardrail_events"
  ON public.guardrail_events FOR DELETE
  TO authenticated
  USING (true);

-- Add table comment
COMMENT ON TABLE public.guardrail_events IS 'Tracks chatbot moderation events (spam, vulgar content, off-topic)';
