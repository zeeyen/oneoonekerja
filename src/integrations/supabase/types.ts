export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_actions: {
        Row: {
          action_type: string
          admin_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action_type: string
          admin_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action_type?: string
          admin_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_actions_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean | null
          role: Database["public"]["Enums"]["admin_role"] | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean | null
          role?: Database["public"]["Enums"]["admin_role"] | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          role?: Database["public"]["Enums"]["admin_role"] | null
        }
        Relationships: []
      }
      applicants: {
        Row: {
          age: number | null
          availability: Json | null
          ban_reason: string | null
          banned_until: string | null
          conversation_state: Json | null
          created_at: string | null
          current_job_matches: string[] | null
          full_name: string | null
          gender: string | null
          has_transport: boolean | null
          ic_number: string | null
          id: string
          is_active: boolean | null
          is_oku: boolean | null
          last_active_at: string | null
          last_violation_at: string | null
          latitude: number | null
          location_city: string | null
          location_postcode: string | null
          location_state: string | null
          longitude: number | null
          onboarding_status: string | null
          onboarding_step: string | null
          phone_number: string
          preferred_job_types: string[] | null
          preferred_language: string | null
          preferred_positions: string[] | null
          transport_type: string | null
          updated_at: string | null
          violation_count: number | null
          years_experience: number | null
        }
        Insert: {
          age?: number | null
          availability?: Json | null
          ban_reason?: string | null
          banned_until?: string | null
          conversation_state?: Json | null
          created_at?: string | null
          current_job_matches?: string[] | null
          full_name?: string | null
          gender?: string | null
          has_transport?: boolean | null
          ic_number?: string | null
          id?: string
          is_active?: boolean | null
          is_oku?: boolean | null
          last_active_at?: string | null
          last_violation_at?: string | null
          latitude?: number | null
          location_city?: string | null
          location_postcode?: string | null
          location_state?: string | null
          longitude?: number | null
          onboarding_status?: string | null
          onboarding_step?: string | null
          phone_number: string
          preferred_job_types?: string[] | null
          preferred_language?: string | null
          preferred_positions?: string[] | null
          transport_type?: string | null
          updated_at?: string | null
          violation_count?: number | null
          years_experience?: number | null
        }
        Update: {
          age?: number | null
          availability?: Json | null
          ban_reason?: string | null
          banned_until?: string | null
          conversation_state?: Json | null
          created_at?: string | null
          current_job_matches?: string[] | null
          full_name?: string | null
          gender?: string | null
          has_transport?: boolean | null
          ic_number?: string | null
          id?: string
          is_active?: boolean | null
          is_oku?: boolean | null
          last_active_at?: string | null
          last_violation_at?: string | null
          latitude?: number | null
          location_city?: string | null
          location_postcode?: string | null
          location_state?: string | null
          longitude?: number | null
          onboarding_status?: string | null
          onboarding_step?: string | null
          phone_number?: string
          preferred_job_types?: string[] | null
          preferred_language?: string | null
          preferred_positions?: string[] | null
          transport_type?: string | null
          updated_at?: string | null
          violation_count?: number | null
          years_experience?: number | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string | null
          direction: string
          id: string
          llm_tokens_used: number | null
          message_content: string | null
          message_type: string | null
          phone_number: string
          processing_time_ms: number | null
          raw_payload: Json | null
          user_id: string | null
          wa_message_id: string | null
        }
        Insert: {
          created_at?: string | null
          direction: string
          id?: string
          llm_tokens_used?: number | null
          message_content?: string | null
          message_type?: string | null
          phone_number: string
          processing_time_ms?: number | null
          raw_payload?: Json | null
          user_id?: string | null
          wa_message_id?: string | null
        }
        Update: {
          created_at?: string | null
          direction?: string
          id?: string
          llm_tokens_used?: number | null
          message_content?: string | null
          message_type?: string | null
          phone_number?: string
          processing_time_ms?: number | null
          raw_payload?: Json | null
          user_id?: string | null
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
        ]
      }
      job_matches: {
        Row: {
          created_at: string | null
          id: string
          job_id: string
          match_reasons: Json | null
          match_score: number | null
          presented_at: string | null
          rejection_reason: string | null
          responded_at: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id: string
          match_reasons?: Json | null
          match_score?: number | null
          presented_at?: string | null
          rejection_reason?: string | null
          responded_at?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string
          match_reasons?: Json | null
          match_score?: number | null
          presented_at?: string | null
          rejection_reason?: string | null
          responded_at?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_matches_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_matches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
        ]
      }
      job_selections: {
        Row: {
          apply_url: string | null
          company: string | null
          id: string
          job_id: string | null
          job_title: string
          location_city: string | null
          location_state: string | null
          selected_at: string | null
          user_id: string | null
        }
        Insert: {
          apply_url?: string | null
          company?: string | null
          id?: string
          job_id?: string | null
          job_title: string
          location_city?: string | null
          location_state?: string | null
          selected_at?: string | null
          user_id?: string | null
        }
        Update: {
          apply_url?: string | null
          company?: string | null
          id?: string
          job_id?: string | null
          job_title?: string
          location_city?: string | null
          location_state?: string | null
          selected_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_selections_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_selections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          company: string | null
          country: string | null
          created_at: string | null
          expire_by: string
          external_job_id: string | null
          gender_requirement: string | null
          id: string
          industry: string | null
          last_edited_at: string | null
          last_edited_by: string | null
          latitude: number | null
          location_address: string | null
          location_city: string | null
          location_state: string | null
          longitude: number | null
          max_age: number | null
          min_age: number | null
          min_experience_years: number | null
          postcode: string | null
          salary_range: string | null
          title: string
          url: string | null
        }
        Insert: {
          company?: string | null
          country?: string | null
          created_at?: string | null
          expire_by: string
          external_job_id?: string | null
          gender_requirement?: string | null
          id?: string
          industry?: string | null
          last_edited_at?: string | null
          last_edited_by?: string | null
          latitude?: number | null
          location_address?: string | null
          location_city?: string | null
          location_state?: string | null
          longitude?: number | null
          max_age?: number | null
          min_age?: number | null
          min_experience_years?: number | null
          postcode?: string | null
          salary_range?: string | null
          title: string
          url?: string | null
        }
        Update: {
          company?: string | null
          country?: string | null
          created_at?: string | null
          expire_by?: string
          external_job_id?: string | null
          gender_requirement?: string | null
          id?: string
          industry?: string | null
          last_edited_at?: string | null
          last_edited_by?: string | null
          latitude?: number | null
          location_address?: string | null
          location_city?: string | null
          location_state?: string | null
          longitude?: number | null
          max_age?: number | null
          min_age?: number | null
          min_experience_years?: number | null
          postcode?: string | null
          salary_range?: string | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_last_edited_by_fkey"
            columns: ["last_edited_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      malaysia_locations: {
        Row: {
          aliases: string[] | null
          created_at: string | null
          id: string
          is_geocoded: boolean | null
          latitude: number
          longitude: number
          name: string
          state: string
          state_code: string | null
        }
        Insert: {
          aliases?: string[] | null
          created_at?: string | null
          id?: string
          is_geocoded?: boolean | null
          latitude: number
          longitude: number
          name: string
          state: string
          state_code?: string | null
        }
        Update: {
          aliases?: string[] | null
          created_at?: string | null
          id?: string
          is_geocoded?: boolean | null
          latitude?: number
          longitude?: number
          name?: string
          state?: string
          state_code?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_admin_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["admin_role"]
      }
      get_job_match_counts: {
        Args: { since_ts?: string }
        Returns: {
          job_id: string
          match_count: number
        }[]
      }
      has_dashboard_access: { Args: { _user_id: string }; Returns: boolean }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      admin_role: "admin" | "staff"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      admin_role: ["admin", "staff"],
    },
  },
} as const
