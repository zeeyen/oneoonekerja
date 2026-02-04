// Database types for 101Kerja

export interface Applicant {
  id: string;
  phone_number: string;
  ic_number: string | null;
  full_name: string | null;
  age: number | null;
  gender: 'male' | 'female' | null;
  preferred_language: 'ms' | 'en' | 'zh';
  location_city: string | null;
  location_state: string | null;
  location_postcode: string | null;
  preferred_job_types: string[];
  preferred_positions: string[];
  years_experience: number;
  has_transport: boolean;
  transport_type: string | null;
  is_oku: boolean;
  availability: Record<string, boolean>;
  onboarding_status: 'new' | 'in_progress' | 'completed';
  onboarding_step: string | null;
  conversation_state: Record<string, unknown>;
  is_active: boolean;
  last_active_at: string;
  created_at: string;
  updated_at: string;
}

// Note: The database uses 'applicants' table (formerly 'users')
// The user_id field in job_matches references applicants(id)

export interface Job {
  id: string;
  title: string;
  company: string | null;
  location_state: string | null;
  location_city: string | null;
  min_experience_years: number;
  salary_range: string | null;
  gender_requirement: 'male' | 'female' | 'any';
  industry: string | null;
  url: string | null;
  created_at: string;
  expire_by: string; // date string
  min_age: number | null;
  max_age: number | null;
  lat: number | null;
  lng: number | null;
}

export interface Conversation {
  id: string;
  user_id: string | null;
  phone_number: string;
  direction: 'inbound' | 'outbound';
  message_type: 'text' | 'location' | 'image' | 'button';
  message_content: string | null;
  raw_payload: Record<string, unknown>;
  wa_message_id: string | null;
  llm_tokens_used: number;
  processing_time_ms: number | null;
  created_at: string;
}

export interface JobMatch {
  id: string;
  user_id: string;
  job_id: string;
  match_score: number | null;
  match_reasons: string[];
  status: 'presented' | 'accepted' | 'rejected' | 'expired';
  rejection_reason: string | null;
  presented_at: string;
  responded_at: string | null;
  created_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'staff';
  is_active: boolean;
  created_at: string;
}

export interface GuardrailEvent {
  id: string;
  user_id: string | null;
  event_type: 'deviation' | 'vulgar' | 'spam';
  message_content: string | null;
  warning_count: number;
  action_taken: 'warning' | 'timeout' | 'none' | null;
  created_at: string;
}
