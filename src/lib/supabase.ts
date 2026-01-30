import { createClient } from '@supabase/supabase-js';

// Supabase configuration - these are publishable keys (safe for client-side)
const supabaseUrl = 'https://gbvegikhzqxdxpldfdls.supabase.co';
const supabaseAnonKey = 'sb_publishable_BRP5KopAmvxgwFGgCmqdOA_EAmdxsjv';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type { User, Session } from '@supabase/supabase-js';
