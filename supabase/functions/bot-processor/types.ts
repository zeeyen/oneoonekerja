// types.ts — All interfaces and types for bot-processor

export interface User {
  id: string
  phone_number: string
  full_name?: string
  age?: number
  gender?: string
  preferred_language?: string
  location_city?: string
  location_state?: string
  latitude?: number
  longitude?: number
  onboarding_status: string
  onboarding_step?: string
  conversation_state?: Record<string, any>
  is_active?: boolean
  last_active_at?: string
  // Violation tracking
  violation_count?: number
  banned_until?: string
  ban_reason?: string
  last_violation_at?: string
}

export interface ProcessRequest {
  user: User
  message: string
  messageType: string
  locationData?: any
}

export interface GPTMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ExtractedInfo {
  name: string | null
  age: number | null
  gender: string | null
  city: string | null
  state: string | null
  lat: number | null
  lng: number | null
  ambiguous?: boolean  // True if location name exists in multiple states
  possible_states?: string[]  // List of states where this location exists
}

export interface MatchedJob {
  id: string
  title: string
  company: string
  location_city: string
  location_state: string
  salary_range: string | null
  url: string | null
  industry?: string
  distance?: number
  external_job_id?: string
  job_type?: string
}

export interface JobSelection {
  id: string
  job_id: string
  job_title: string
  company: string | null
  location_city: string | null
  location_state: string | null
  apply_url: string | null
  selected_at: string
}

export type SlotKey = 'name' | 'age' | 'gender' | 'location'

export interface SlotMemory {
  value: string | number | null
  confidence: number
  locked: boolean
  seen_count: number
}
