export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      attachments: {
        Row: {
          id: string
          message_id: string
          file_name: string
          file_type: string
          file_size: number
          file_path: string
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          file_name: string
          file_type: string
          file_size: number
          file_path: string
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          file_name?: string
          file_type?: string
          file_size?: number
          file_path?: string
          created_at?: string
        }
      }
      chat_sessions: {
        Row: {
          id: string
          user_id: string
          title: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          created_at?: string
          updated_at?: string
        }
      }
      constitution_embeddings: {
        Row: {
          id: number
          content: string
          embedding: number[]
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: number
          content: string
          embedding: number[]
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: number
          content?: string
          embedding?: number[]
          metadata?: Json | null
          created_at?: string
        }
      }
      document_embeddings: {
        Row: {
          id: number
          document_id: string
          content: string
          embedding: number[]
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: number
          document_id: string
          content: string
          embedding: number[]
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: number
          document_id?: string
          content?: string
          embedding?: number[]
          metadata?: Json | null
          created_at?: string
        }
      }
      feedback: {
        Row: {
          id: string
          message_id: string
          user_id: string
          rating: number
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
          rating: number
          comment?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          user_id?: string
          rating?: number
          comment?: string | null
          created_at?: string
        }
      }
      lawyers: {
        Row: {
          id: string
          user_id: string
          full_name: string
          email: string
          phone: string | null
          specialization: string
          experience_years: number
          bio: string | null
          address: string
          city: string
          state: string
          country: string
          postal_code: string | null
          latitude: number | null
          longitude: number | null
          is_verified: boolean
          is_available: boolean
          rating: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          full_name: string
          email: string
          phone?: string | null
          specialization: string
          experience_years: number
          bio?: string | null
          address: string
          city: string
          state: string
          country: string
          postal_code?: string | null
          latitude?: number | null
          longitude?: number | null
          is_verified?: boolean
          is_available?: boolean
          rating?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          full_name?: string
          email?: string
          phone?: string | null
          specialization?: string
          experience_years?: number
          bio?: string | null
          address?: string
          city?: string
          state?: string
          country?: string
          postal_code?: string | null
          latitude?: number | null
          longitude?: number | null
          is_verified?: boolean
          is_available?: boolean
          rating?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      legal_requests: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string
          legal_area: string
          urgency: string
          address: string
          city: string
          state: string
          country: string
          postal_code: string | null
          latitude: number | null
          longitude: number | null
          status: string
          assigned_lawyer_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description: string
          legal_area: string
          urgency: string
          address: string
          city: string
          state: string
          country: string
          postal_code?: string | null
          latitude?: number | null
          longitude?: number | null
          status?: string
          assigned_lawyer_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string
          legal_area?: string
          urgency?: string
          address?: string
          city?: string
          state?: string
          country?: string
          postal_code?: string | null
          latitude?: number | null
          longitude?: number | null
          status?: string
          assigned_lawyer_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      lawyer_matches: {
        Row: {
          id: string
          legal_request_id: string
          lawyer_id: string
          user_id: string
          status: string
          match_score: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          legal_request_id: string
          lawyer_id: string
          user_id: string
          status?: string
          match_score?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          legal_request_id?: string
          lawyer_id?: string
          user_id?: string
          status?: string
          match_score?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      lawyer_messages: {
        Row: {
          id: string
          match_id: string
          sender_id: string
          content: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          match_id: string
          sender_id: string
          content: string
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          match_id?: string
          sender_id?: string
          content?: string
          is_read?: boolean
          created_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          chat_session_id: string
          user_id: string
          content: string
          is_bot: boolean
          created_at: string
        }
        Insert: {
          id?: string
          chat_session_id: string
          user_id: string
          content: string
          is_bot?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          chat_session_id?: string
          user_id?: string
          content?: string
          is_bot?: boolean
          created_at?: string
        }
      }
      user_documents: {
        Row: {
          id: string
          user_id: string
          file_name: string
          file_type: string
          file_size: number
          file_path: string
          processed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          file_name: string
          file_type: string
          file_size: number
          file_path: string
          processed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          file_name?: string
          file_type?: string
          file_size?: number
          file_path?: string
          processed?: boolean
          created_at?: string
        }
      }
      users: {
        Row: {
          id: string
          full_name: string
          created_at: string
          updated_at: string
          address: string | null
          city: string | null
          state: string | null
          country: string | null
          postal_code: string | null
          latitude: number | null
          longitude: number | null
        }
        Insert: {
          id: string
          full_name: string
          created_at?: string
          updated_at?: string
          address?: string | null
          city?: string | null
          state?: string | null
          country?: string | null
          postal_code?: string | null
          latitude?: number | null
          longitude?: number | null
        }
        Update: {
          id?: string
          full_name?: string
          created_at?: string
          updated_at?: string
          address?: string | null
          city?: string | null
          state?: string | null
          country?: string | null
          postal_code?: string | null
          latitude?: number | null
          longitude?: number | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_documents: {
        Args: {
          query_embedding: number[]
          match_threshold: number
          match_count: number
          filter_document_id?: string
        }
        Returns: {
          id: number
          content: string
          metadata: Json
          similarity: number
          document_id: string | null
        }[]
      }
      handle_new_user: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      update_updated_at: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      calculate_distance: {
        Args: {
          lat1: number
          lon1: number
          lat2: number
          lon2: number
        }
        Returns: number
      }
      find_nearby_lawyers: {
        Args: {
          request_id: string
          max_distance?: number
        }
        Returns: {
          lawyer_id: string
          distance: number
          match_score: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Type definitions for the lawyer matching system
export type LawyerType = Database["public"]["Tables"]["lawyers"]["Row"]
export type NewLawyer = Database["public"]["Tables"]["lawyers"]["Insert"]
export type UpdateLawyer = Database["public"]["Tables"]["lawyers"]["Update"]

export type LegalRequestType = Database["public"]["Tables"]["legal_requests"]["Row"]
export type NewLegalRequest = Database["public"]["Tables"]["legal_requests"]["Insert"]
export type UpdateLegalRequest = Database["public"]["Tables"]["legal_requests"]["Update"]

export type LawyerMatchType = Database["public"]["Tables"]["lawyer_matches"]["Row"]
export type NewLawyerMatch = Database["public"]["Tables"]["lawyer_matches"]["Insert"]
export type UpdateLawyerMatch = Database["public"]["Tables"]["lawyer_matches"]["Update"]

export type LawyerMessageRow = Database["public"]["Tables"]["lawyer_messages"]["Row"]
export type NewLawyerMessage = Database["public"]["Tables"]["lawyer_messages"]["Insert"]
export type UpdateLawyerMessage = Database["public"]["Tables"]["lawyer_messages"]["Update"]

// Legal specializations
export const LEGAL_SPECIALIZATIONS = [
  "Constitutional Law",
  "Criminal Law",
  "Civil Law",
  "Family Law",
  "Corporate Law",
  "Intellectual Property",
  "Tax Law",
  "Labor Law",
  "Environmental Law",
  "Immigration Law",
  "Real Estate Law",
  "Bankruptcy Law",
  "Personal Injury",
  "Medical Malpractice",
  "Estate Planning",
  "Human Rights Law",
  "International Law",
  "Administrative Law",
  "Consumer Law",
  "Other",
] as const

export type LegalSpecialization = (typeof LEGAL_SPECIALIZATIONS)[number]

// Request urgency levels
export const URGENCY_LEVELS = ["Low", "Medium", "High", "Emergency"] as const

export type UrgencyLevel = (typeof URGENCY_LEVELS)[number]

// Request status
export const REQUEST_STATUSES = ["pending", "assigned", "in_progress", "resolved", "closed"] as const

export type RequestStatus = (typeof REQUEST_STATUSES)[number]

// Match status
export const MATCH_STATUSES = ["pending", "accepted", "rejected", "completed"] as const

export type MatchStatus = (typeof MATCH_STATUSES)[number]

export type User = {
  id: string
  full_name: string
  email?: string
  created_at: string
  updated_at: string
  address?: string
  city?: string
  state?: string
  country?: string
  postal_code?: string
  latitude?: number
  longitude?: number
}

export type ChatSession = {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
}

export type Message = {
  id: string
  chat_session_id: string
  user_id: string
  content: string
  is_bot: boolean
  created_at: string
}

export type Attachment = {
  id: string
  message_id: string
  file_name: string
  file_type: string
  file_size: number
  file_path: string
  created_at: string
}

export type Feedback = {
  id: string
  message_id: string
  user_id: string
  rating: number
  comment?: string
  created_at: string
}

export type UserDocument = {
  id: string
  user_id: string
  file_name: string
  file_type: string
  file_size: number
  file_path: string
  processed: boolean
  created_at: string
}

export type Lawyer = {
  id: string
  user_id: string
  full_name: string
  email: string
  phone?: string
  specialization: string
  experience_years: number
  bio?: string
  address: string
  city: string
  state: string
  country: string
  postal_code?: string
  latitude?: number
  longitude?: number
  is_verified: boolean
  is_available: boolean
  rating?: number
  created_at: string
  updated_at: string
}

export type LegalRequest = {
  id: string
  user_id: string
  title: string
  description: string
  legal_area: string
  urgency: string
  address: string
  city: string
  state: string
  country: string
  postal_code?: string
  latitude?: number
  longitude?: number
  status: string
  assigned_lawyer_id?: string
  created_at: string
  updated_at: string
}

export type LawyerMatch = {
  id: string
  legal_request_id: string
  lawyer_id: string
  user_id: string
  status: string
  match_score?: number
  created_at: string
  updated_at: string
}

export type LawyerMessage = {
  id: string
  match_id: string
  sender_id: string
  content: string
  is_read: boolean
  created_at: string
}

export type ConstitutionEmbedding = {
  id: number
  content: string
  embedding: number[]
  metadata?: Record<string, any>
  created_at: string
}

export type DocumentEmbedding = {
  id: number
  document_id: string
  content: string
  embedding: number[]
  metadata?: Record<string, any>
  created_at: string
}