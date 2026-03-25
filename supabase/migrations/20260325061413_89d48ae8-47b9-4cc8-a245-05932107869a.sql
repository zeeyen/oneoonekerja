ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS branch text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';