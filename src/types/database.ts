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

// Alias for backwards compatibility during migration
export type User = Applicant;

export interface Job {
  id: string;
  external_job_id: number | null;
  job_title: string;
  position: string;
  job_type: 1 | 2 | null; // 1 = part_time, 2 = full_time
  branch_id: number | null;
  branch_name: string | null;
  location_city: string | null;
  location_state: string | null;
  location_postcode: string | null;
  gender_requirement: 'male' | 'female' | 'any';
  age_min: number | null;
  age_max: number | null;
  is_oku_friendly: boolean;
  num_shifts: number | null;
  shift_details: Record<string, unknown>;
  hourly_rate: number | null;
  start_date: string | null;
  end_date: string | null;
  whatsapp_group_link: string | null;
  is_active: boolean;
  slots_available: number;
  created_at: string;
  updated_at: string;
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
