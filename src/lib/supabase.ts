import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gbvegikhzqxdxpldfdls.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseAnonKey) {
  console.warn(
    '⚠️ VITE_SUPABASE_ANON_KEY is not set. Please add it to your environment variables.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type { User, Session } from '@supabase/supabase-js';
