-- =============================================
-- 101Kerja: Admin Users Table (Dashboard Access Control)
-- Run this in Supabase SQL Editor
-- =============================================

-- Create enum for admin roles
CREATE TYPE public.admin_role AS ENUM ('admin', 'staff');

-- Create the admin_users table for dashboard access control
CREATE TABLE public.admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role admin_role DEFAULT 'staff',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_admin_users_email ON public.admin_users(email);
CREATE INDEX idx_admin_users_is_active ON public.admin_users(is_active);

-- Enable Row Level Security
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Security definer function to check if user is admin (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE id = _user_id
      AND role = 'admin'
      AND is_active = true
  )
$$;

-- Security definer function to check if user has dashboard access
CREATE OR REPLACE FUNCTION public.has_dashboard_access(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE id = _user_id
      AND is_active = true
  )
$$;

-- Security definer function to get user's admin role
CREATE OR REPLACE FUNCTION public.get_admin_role(_user_id UUID)
RETURNS admin_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.admin_users
  WHERE id = _user_id
    AND is_active = true
$$;

-- RLS Policies

-- Users can read their own row, admins can read all
CREATE POLICY "Users can view own row, admins can view all"
  ON public.admin_users FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR public.is_admin(auth.uid())
  );

-- Only admins can insert new admin users
CREATE POLICY "Only admins can insert admin users"
  ON public.admin_users FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- Users can update their own row (name only), admins can update all
CREATE POLICY "Users can update own row, admins can update all"
  ON public.admin_users FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid() OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    id = auth.uid() OR public.is_admin(auth.uid())
  );

-- Only admins can delete
CREATE POLICY "Only admins can delete admin users"
  ON public.admin_users FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Add table comment
COMMENT ON TABLE public.admin_users IS 'Dashboard access control - links to auth.users for login verification';

-- =============================================
-- IMPORTANT: After running this migration, you must:
-- 1. Create a user in Supabase Auth (Authentication > Users > Add user)
-- 2. Insert a row into admin_users with that user's ID:
--
-- INSERT INTO public.admin_users (id, email, full_name, role)
-- VALUES (
--   'your-auth-user-uuid-here',
--   'admin@example.com',
--   'Admin Name',
--   'admin'
-- );
-- =============================================
