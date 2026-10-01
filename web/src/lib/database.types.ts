export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      activity_events: {
        Row: {
          actor_id: string | null
          at: string
          circle_id: string
          data: Json
          id: number
          item_id: string | null
          type: string
        }
        Insert: {
          actor_id?: string | null
          at?: string
          circle_id: string
          data?: Json
          id?: number
          item_id?: string | null
          type: string
        }
        Update: {
          actor_id?: string | null
          at?: string
          circle_id?: string
          data?: Json
          id?: number
          item_id?: string | null
          type?: string
        }
        Relationships: []
      }
      assignment_requests: {
        Row: {
          assignee_id: string | null
          assigner_id: string | null
          circle_id: string
          created_at: string
          id: string
          item_id: string
          resolved_at: string | null
          scope: string
          status: string
        }
        Insert: {
          assignee_id?: string | null
          assigner_id?: string | null
          circle_id: string
          created_at?: string
          id?: string
          item_id: string
          resolved_at?: string | null
          scope?: string
          status?: string
        }
        Update: {
          assignee_id?: string | null
          assigner_id?: string | null
          circle_id?: string
          created_at?: string
          id?: string
          item_id?: string
          resolved_at?: string | null
          scope?: string
          status?: string
        }
        Relationships: []
      }
      calendar_settings: {
        Row: {
          feed_appointments: boolean
          feed_tasks: boolean
          feed_token: string
          google_secret_id: string | null
          user_id: string
        }
        Insert: {
          feed_appointments?: boolean
          feed_tasks?: boolean
          feed_token?: string
          google_secret_id?: string | null
          user_id: string
        }
        Update: {
          feed_appointments?: boolean
          feed_tasks?: boolean
          feed_token?: string
          google_secret_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      circle_members: {
        Row: {
          circle_id: string
          joined_at: string
          relationship: string | null
          role: string
          user_id: string
        }
        Insert: {
          circle_id: string
          joined_at?: string
          relationship?: string | null
          role?: string
          user_id: string
        }
        Update: {
          circle_id?: string
          joined_at?: string
          relationship?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      circles: {
        Row: {
          care_recipient_name: string
          created_at: string
          id: string
          time_zone: string
        }
        Insert: {
          care_recipient_name: string
          created_at?: string
          id?: string
          time_zone?: string
        }
        Update: {
          care_recipient_name?: string
          created_at?: string
          id?: string
          time_zone?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          author_id: string | null
          body: string
          circle_id: string
          created_at: string
          id: string
          item_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          circle_id: string
          created_at?: string
          id?: string
          item_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          circle_id?: string
          created_at?: string
          id?: string
          item_id?: string
        }
        Relationships: []
      }
      coverage_requests: {
        Row: {
          circle_id: string
          created_at: string
          id: string
          item_id: string
          requester_id: string | null
          resolved_at: string | null
          status: string
          taken_by: string | null
        }
        Insert: {
          circle_id: string
          created_at?: string
          id?: string
          item_id: string
          requester_id?: string | null
          resolved_at?: string | null
          status?: string
          taken_by?: string | null
        }
        Update: {
          circle_id?: string
          created_at?: string
          id?: string
          item_id?: string
          requester_id?: string | null
          resolved_at?: string | null
          status?: string
          taken_by?: string | null
        }
        Relationships: []
      }
      invites: {
        Row: {
          circle_id: string
          code: string
          created_at: string
          created_by: string | null
          expires_at: string
        }
        Insert: {
          circle_id: string
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
        }
        Update: {
          circle_id?: string
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
        }
        Relationships: []
      }
      items: {
        Row: {
          circle_id: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          follow_up_of: string | null
          id: string
          kind: string
          location: string | null
          location_lat: number | null
          location_lng: number | null
          owner_id: string | null
          private_notes: string | null
          proposed_assignee_id: string | null
          series_id: string | null
          starts_at: string
          state: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          circle_id: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          follow_up_of?: string | null
          id?: string
          kind: string
          location?: string | null
          location_lat?: number | null
          location_lng?: number | null
          owner_id?: string | null
          private_notes?: string | null
          proposed_assignee_id?: string | null
          series_id?: string | null
          starts_at: string
          state?: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          circle_id?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          follow_up_of?: string | null
          id?: string
          kind?: string
          location?: string | null
          location_lat?: number | null
          location_lng?: number | null
          owner_id?: string | null
          private_notes?: string | null
          proposed_assignee_id?: string | null
          series_id?: string | null
          starts_at?: string
          state?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      notification_prefs: {
        Row: {
          changes: boolean
          comments: boolean
          everything_else: boolean
          reminders: boolean
          requests: boolean
          updates: boolean
          user_id: string
          weekly_summary: boolean
        }
        Insert: {
          changes?: boolean
          comments?: boolean
          everything_else?: boolean
          reminders?: boolean
          requests?: boolean
          updates?: boolean
          user_id: string
          weekly_summary?: boolean
        }
        Update: {
          changes?: boolean
          comments?: boolean
          everything_else?: boolean
          reminders?: boolean
          requests?: boolean
          updates?: boolean
          user_id?: string
          weekly_summary?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: number
          item_id: string | null
          kind: string
          line: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          item_id?: string | null
          kind: string
          line: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          item_id?: string | null
          kind?: string
          line?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      outbox: {
        Row: {
          attempts: number
          circle_id: string | null
          created_at: string
          id: number
          kind: string
          last_error: string | null
          payload: Json
          run_at: string
          status: string
        }
        Insert: {
          attempts?: number
          circle_id?: string | null
          created_at?: string
          id?: number
          kind: string
          last_error?: string | null
          payload?: Json
          run_at?: string
          status?: string
        }
        Update: {
          attempts?: number
          circle_id?: string | null
          created_at?: string
          id?: number
          kind?: string
          last_error?: string | null
          payload?: Json
          run_at?: string
          status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: number
          keys: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: number
          keys: Json
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: number
          keys?: Json
          user_id?: string
        }
        Relationships: []
      }
      series: {
        Row: {
          circle_id: string
          created_at: string
          created_by: string | null
          id: string
          repeat: string
          until: string | null
        }
        Insert: {
          circle_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          repeat: string
          until?: string | null
        }
        Update: {
          circle_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          repeat?: string
          until?: string | null
        }
        Relationships: []
      }
      updates: {
        Row: {
          author_id: string | null
          body: string
          circle_id: string
          created_at: string
          id: string
          item_id: string | null
        }
        Insert: {
          author_id?: string | null
          body: string
          circle_id: string
          created_at?: string
          id?: string
          item_id?: string | null
        }
        Update: {
          author_id?: string | null
          body?: string
          circle_id?: string
          created_at?: string
          id?: string
          item_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_assignment: { Args: { item_id: string; version: number }; Returns: {
          circle_id: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          follow_up_of: string | null
          id: string
          kind: string
          location: string | null
          location_lat: number | null
          location_lng: number | null
          owner_id: string | null
          private_notes: string | null
          proposed_assignee_id: string | null
          series_id: string | null
          starts_at: string
          state: string
          title: string
          updated_at: string
          version: number
        } }
      accept_coverage: { Args: { item_id: string; version: number }; Returns: {
          circle_id: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          follow_up_of: string | null
          id: string
          kind: string
          location: string | null
          location_lat: number | null
          location_lng: number | null
          owner_id: string | null
          private_notes: string | null
          proposed_assignee_id: string | null
          series_id: string | null
          starts_at: string
          state: string
          title: string
          updated_at: string
          version: number
        } }
      assign: { Args: { assignee_id: string; item_id: string; version: number }; Returns: {
          circle_id: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          follow_up_of: string | null
          id: string
          kind: string
          location: string | null
          location_lat: number | null
          location_lng: number | null
          owner_id: string | null
          private_notes: string | null
          proposed_assignee_id: string | null
          series_id: string | null
          starts_at: string
          state: string
          title: string
          updated_at: string
          version: number
        } }
      cancel_coverage: { Args: { item_id: string; version: number }; Returns: {
          circle_id: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          follow_up_of: string | null
          id: string
          kind: string
          location: string | null
          location_lat: number | null
          location_lng: number | null
          owner_id: string | null
          private_notes: string | null
          proposed_assignee_id: string | null
          series_id: string | null
          starts_at: string
          state: string
          title: string
          updated_at: string
          version: number
        } }
      cancel_item: { Args: { item_id: string; version: number }; Returns: {
          circle_id: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          follow_up_of: string | null
          id: string
          kind: string
          location: string | null
          location_lat: number | null
          location_lng: number | null
          owner_id: string | null
          private_notes: string | null
          proposed_assignee_id: string | null
          series_id: string | null
          starts_at: string
          state: string
          title: string
          updated_at: string
          version: number
        } }
      claim: { Args: { item_id: string; version: number }; Returns: {
          circle_id: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          follow_up_of: string | null
          id: string
          kind: string
          location: string | null
          location_lat: number | null
          location_lng: number | null
          owner_id: string | null
          private_notes: string | null
          proposed_assignee_id: string | null
          series_id: string | null
          starts_at: string
          state: string
          title: string
          updated_at: string
          version: number
        } }
      complete_item: { Args: { item_id: string; version: number }; Returns: {
          circle_id: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          follow_up_of: string | null
          id: string
          kind: string
          location: string | null
          location_lat: number | null
          location_lng: number | null
          owner_id: string | null
          private_notes: string | null
          proposed_assignee_id: string | null
          series_id: string | null
          starts_at: string
          state: string
          title: string
          updated_at: string
          version: number
        } }
      coverage_remaining: { Args: never; Returns: number }
      create_circle: { Args: {
          care_recipient_name: string
          relationship: string
          time_zone: string
        }; Returns: string }
      create_invite: { Args: never; Returns: string }
      create_item: { Args: {
          assignee_id?: string
          ends_at?: string
          follow_up_of?: string
          kind: string
          location?: string
          private_notes?: string
          repeat?: string
          starts_at: string
          title: string
          until?: string
        }; Returns: string }
      decline_assignment: { Args: { item_id: string; version: number }; Returns: {
          circle_id: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          follow_up_of: string | null
          id: string
          kind: string
          location: string | null
          location_lat: number | null
          location_lng: number | null
          owner_id: string | null
          private_notes: string | null
          proposed_assignee_id: string | null
          series_id: string | null
          starts_at: string
          state: string
          title: string
          updated_at: string
          version: number
        } }
      join_circle: { Args: { code: string; relationship?: string }; Returns: string }
      join_demo_circle: { Args: never; Returns: string }
      leave_circle: { Args: never; Returns: undefined }
      log_share: { Args: { item_id: string; share_kind: string }; Returns: undefined }
      mark_notifications_read: { Args: { notification_id?: number }; Returns: undefined }
      post_update: { Args: { body: string; item_id?: string }; Returns: string }
      remove_member: { Args: { member_id: string }; Returns: undefined }
      request_coverage: { Args: { item_id: string; version: number }; Returns: {
          circle_id: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          follow_up_of: string | null
          id: string
          kind: string
          location: string | null
          location_lat: number | null
          location_lng: number | null
          owner_id: string | null
          private_notes: string | null
          proposed_assignee_id: string | null
          series_id: string | null
          starts_at: string
          state: string
          title: string
          updated_at: string
          version: number
        } }
      reset_demo_circle: { Args: never; Returns: undefined }
      update_item: { Args: { item_id: string; patch: Json; version: number }; Returns: {
          circle_id: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          follow_up_of: string | null
          id: string
          kind: string
          location: string | null
          location_lat: number | null
          location_lng: number | null
          owner_id: string | null
          private_notes: string | null
          proposed_assignee_id: string | null
          series_id: string | null
          starts_at: string
          state: string
          title: string
          updated_at: string
          version: number
        } }
      weekly_summary: { Args: { week_start: string }; Returns: {
          at: string
          count: number
          item_id: string
          item_title: string
          kind: string
          person_id: string
        }[] }
      withdraw_assignment: { Args: { item_id: string; version: number }; Returns: {
          circle_id: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          follow_up_of: string | null
          id: string
          kind: string
          location: string | null
          location_lat: number | null
          location_lng: number | null
          owner_id: string | null
          private_notes: string | null
          proposed_assignee_id: string | null
          series_id: string | null
          starts_at: string
          state: string
          title: string
          updated_at: string
          version: number
        } }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

