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
          full_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          created_at?: string
          updated_at?: string
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
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
