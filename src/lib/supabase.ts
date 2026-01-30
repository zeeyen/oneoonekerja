import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gbvegikhzqxdxpldfdls.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug: log what we have (without exposing full key)
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key present:', !!supabaseAnonKey, supabaseAnonKey ? `(${supabaseAnonKey.substring(0, 20)}...)` : '(missing)');

if (!supabaseAnonKey) {
  throw new Error(
    'VITE_SUPABASE_ANON_KEY is not set. Please add the Supabase anon (publishable) key to your environment secrets.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type { User, Session } from '@supabase/supabase-js';
