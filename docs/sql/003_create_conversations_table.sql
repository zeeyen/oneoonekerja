-- =============================================
-- 101Kerja: WhatsApp Conversations Log Table
-- Run this in Supabase SQL Editor
-- =============================================

-- Create the conversations table for WhatsApp message logging
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Applicant Reference (nullable for unknown applicants)
  user_id UUID REFERENCES public.applicants(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  
  -- Message Details
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'location', 'image', 'button')),
  message_content TEXT,
  
  -- WhatsApp Metadata
  raw_payload JSONB DEFAULT '{}',
  wa_message_id TEXT,
  
  -- Performance Metrics
  llm_tokens_used INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX idx_conversations_phone_number ON public.conversations(phone_number);
CREATE INDEX idx_conversations_created_at ON public.conversations(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow all operations for authenticated users
CREATE POLICY "Authenticated users can view all conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert conversations"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update conversations"
  ON public.conversations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete conversations"
  ON public.conversations FOR DELETE
  TO authenticated
  USING (true);

-- Add table comment
COMMENT ON TABLE public.conversations IS 'WhatsApp message log for chatbot conversations';
