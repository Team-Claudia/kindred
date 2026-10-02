
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activity_events": {
                  Row: {
                    "actor_id": string | null,"at": string,"circle_id": string,"data": NonNullable<Json>,"id": number,"item_id": string | null,"type": string
                  }
                  Insert: {
                    "actor_id"?: string | null,"at"?: string,"circle_id": string,"data"?: NonNullable<Json>,"id"?: never,"item_id"?: string | null,"type": string
                  }
                  Update: {
                    "actor_id"?: string | null,"at"?: string,"circle_id"?: string,"data"?: NonNullable<Json>,"id"?: never,"item_id"?: string | null,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_events_circle_id_fkey"
      columns: ["circle_id"]
isOneToOne: false
      referencedRelation: "circles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_events_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    }
                  ]
                },"assignment_requests": {
                  Row: {
                    "assignee_id": string | null,"assigner_id": string | null,"circle_id": string,"created_at": string,"id": string,"item_id": string,"resolved_at": string | null,"scope": string,"status": string
                  }
                  Insert: {
                    "assignee_id"?: string | null,"assigner_id"?: string | null,"circle_id": string,"created_at"?: string,"id"?: string,"item_id": string,"resolved_at"?: string | null,"scope"?: string,"status"?: string
                  }
                  Update: {
                    "assignee_id"?: string | null,"assigner_id"?: string | null,"circle_id"?: string,"created_at"?: string,"id"?: string,"item_id"?: string,"resolved_at"?: string | null,"scope"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assignment_requests_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assignment_requests_assigner_id_fkey"
      columns: ["assigner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assignment_requests_circle_id_fkey"
      columns: ["circle_id"]
isOneToOne: false
      referencedRelation: "circles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assignment_requests_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    }
                  ]
                },"calendar_settings": {
                  Row: {
                    "feed_appointments": boolean,"feed_tasks": boolean,"feed_token": string,"google_secret_id": string | null,"user_id": string
                  }
                  Insert: {
                    "feed_appointments"?: boolean,"feed_tasks"?: boolean,"feed_token"?: string,"google_secret_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "feed_appointments"?: boolean,"feed_tasks"?: boolean,"feed_token"?: string,"google_secret_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "calendar_settings_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"circle_members": {
                  Row: {
                    "circle_id": string,"joined_at": string,"relationship": string | null,"role": string,"user_id": string
                  }
                  Insert: {
                    "circle_id": string,"joined_at"?: string,"relationship"?: string | null,"role"?: string,"user_id": string
                  }
                  Update: {
                    "circle_id"?: string,"joined_at"?: string,"relationship"?: string | null,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "circle_members_circle_id_fkey"
      columns: ["circle_id"]
isOneToOne: false
      referencedRelation: "circles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "circle_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"circles": {
                  Row: {
                    "care_recipient_name": string,"created_at": string,"id": string,"time_zone": string
                  }
                  Insert: {
                    "care_recipient_name": string,"created_at"?: string,"id"?: string,"time_zone"?: string
                  }
                  Update: {
                    "care_recipient_name"?: string,"created_at"?: string,"id"?: string,"time_zone"?: string
                  }
                  Relationships: [
                    
                  ]
                },"comments": {
                  Row: {
                    "author_id": string | null,"body": string,"circle_id": string,"created_at": string,"id": string,"item_id": string
                  }
                  Insert: {
                    "author_id"?: string | null,"body": string,"circle_id": string,"created_at"?: string,"id"?: string,"item_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"circle_id"?: string,"created_at"?: string,"id"?: string,"item_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_circle_id_fkey"
      columns: ["circle_id"]
isOneToOne: false
      referencedRelation: "circles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    }
                  ]
                },"coverage_requests": {
                  Row: {
                    "circle_id": string,"created_at": string,"id": string,"item_id": string,"requester_id": string | null,"resolved_at": string | null,"status": string,"taken_by": string | null
                  }
                  Insert: {
                    "circle_id": string,"created_at"?: string,"id"?: string,"item_id": string,"requester_id"?: string | null,"resolved_at"?: string | null,"status"?: string,"taken_by"?: string | null
                  }
                  Update: {
                    "circle_id"?: string,"created_at"?: string,"id"?: string,"item_id"?: string,"requester_id"?: string | null,"resolved_at"?: string | null,"status"?: string,"taken_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "coverage_requests_circle_id_fkey"
      columns: ["circle_id"]
isOneToOne: false
      referencedRelation: "circles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coverage_requests_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coverage_requests_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coverage_requests_taken_by_fkey"
      columns: ["taken_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"invites": {
                  Row: {
                    "circle_id": string,"code": string,"created_at": string,"created_by": string | null,"expires_at": string
                  }
                  Insert: {
                    "circle_id": string,"code": string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string
                  }
                  Update: {
                    "circle_id"?: string,"code"?: string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invites_circle_id_fkey"
      columns: ["circle_id"]
isOneToOne: false
      referencedRelation: "circles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"items": {
                  Row: {
                    "circle_id": string,"created_at": string,"created_by": string | null,"ends_at": string | null,"follow_up_of": string | null,"id": string,"kind": string,"location": string | null,"location_lat": number | null,"location_lng": number | null,"owner_id": string | null,"private_notes": string | null,"proposed_assignee_id": string | null,"series_id": string | null,"starts_at": string,"state": string,"title": string,"updated_at": string,"version": number
                  }
                  Insert: {
                    "circle_id": string,"created_at"?: string,"created_by"?: string | null,"ends_at"?: string | null,"follow_up_of"?: string | null,"id"?: string,"kind": string,"location"?: string | null,"location_lat"?: number | null,"location_lng"?: number | null,"owner_id"?: string | null,"private_notes"?: string | null,"proposed_assignee_id"?: string | null,"series_id"?: string | null,"starts_at": string,"state"?: string,"title": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "circle_id"?: string,"created_at"?: string,"created_by"?: string | null,"ends_at"?: string | null,"follow_up_of"?: string | null,"id"?: string,"kind"?: string,"location"?: string | null,"location_lat"?: number | null,"location_lng"?: number | null,"owner_id"?: string | null,"private_notes"?: string | null,"proposed_assignee_id"?: string | null,"series_id"?: string | null,"starts_at"?: string,"state"?: string,"title"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "items_circle_id_fkey"
      columns: ["circle_id"]
isOneToOne: false
      referencedRelation: "circles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "items_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "items_follow_up_of_fkey"
      columns: ["follow_up_of"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "items_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "items_proposed_assignee_id_fkey"
      columns: ["proposed_assignee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "items_series_id_fkey"
      columns: ["series_id"]
isOneToOne: false
      referencedRelation: "series"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_prefs": {
                  Row: {
                    "changes": boolean,"comments": boolean,"everything_else": boolean,"reminders": boolean,"requests": boolean,"updates": boolean,"user_id": string,"weekly_summary": boolean
                  }
                  Insert: {
                    "changes"?: boolean,"comments"?: boolean,"everything_else"?: boolean,"reminders"?: boolean,"requests"?: boolean,"updates"?: boolean,"user_id": string,"weekly_summary"?: boolean
                  }
                  Update: {
                    "changes"?: boolean,"comments"?: boolean,"everything_else"?: boolean,"reminders"?: boolean,"requests"?: boolean,"updates"?: boolean,"user_id"?: string,"weekly_summary"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_prefs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "created_at": string,"id": number,"item_id": string | null,"kind": string,"line": string,"read_at": string | null,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: never,"item_id"?: string | null,"kind": string,"line": string,"read_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"item_id"?: string | null,"kind"?: string,"line"?: string,"read_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"outbox": {
                  Row: {
                    "attempts": number,"circle_id": string | null,"created_at": string,"id": number,"kind": string,"last_error": string | null,"payload": NonNullable<Json>,"run_at": string,"status": string
                  }
                  Insert: {
                    "attempts"?: number,"circle_id"?: string | null,"created_at"?: string,"id"?: never,"kind": string,"last_error"?: string | null,"payload"?: NonNullable<Json>,"run_at"?: string,"status"?: string
                  }
                  Update: {
                    "attempts"?: number,"circle_id"?: string | null,"created_at"?: string,"id"?: never,"kind"?: string,"last_error"?: string | null,"payload"?: NonNullable<Json>,"run_at"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "outbox_circle_id_fkey"
      columns: ["circle_id"]
isOneToOne: false
      referencedRelation: "circles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"id": string
                  }
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_subscriptions": {
                  Row: {
                    "created_at": string,"endpoint": string,"id": number,"keys": NonNullable<Json>,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"endpoint": string,"id"?: never,"keys": NonNullable<Json>,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"endpoint"?: string,"id"?: never,"keys"?: NonNullable<Json>,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"series": {
                  Row: {
                    "circle_id": string,"created_at": string,"created_by": string | null,"id": string,"repeat": string,"until": string | null
                  }
                  Insert: {
                    "circle_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"repeat": string,"until"?: string | null
                  }
                  Update: {
                    "circle_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"repeat"?: string,"until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "series_circle_id_fkey"
      columns: ["circle_id"]
isOneToOne: false
      referencedRelation: "circles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "series_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"updates": {
                  Row: {
                    "author_id": string | null,"body": string,"circle_id": string,"created_at": string,"id": string,"item_id": string | null
                  }
                  Insert: {
                    "author_id"?: string | null,"body": string,"circle_id": string,"created_at"?: string,"id"?: string,"item_id"?: string | null
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"circle_id"?: string,"created_at"?: string,"id"?: string,"item_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "updates_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "updates_circle_id_fkey"
      columns: ["circle_id"]
isOneToOne: false
      referencedRelation: "circles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "updates_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_assignment":
{ Args: { "item_id": string,"version": number }; Returns: {
              "circle_id": string,
"created_at": string,
"created_by": string | null,
"ends_at": string | null,
"follow_up_of": string | null,
"id": string,
"kind": string,
"location": string | null,
"location_lat": number | null,
"location_lng": number | null,
"owner_id": string | null,
"private_notes": string | null,
"proposed_assignee_id": string | null,
"series_id": string | null,
"starts_at": string,
"state": string,
"title": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "items"
        isOneToOne: true
        isSetofReturn: false
      } },
"accept_coverage":
{ Args: { "item_id": string,"version": number }; Returns: {
              "circle_id": string,
"created_at": string,
"created_by": string | null,
"ends_at": string | null,
"follow_up_of": string | null,
"id": string,
"kind": string,
"location": string | null,
"location_lat": number | null,
"location_lng": number | null,
"owner_id": string | null,
"private_notes": string | null,
"proposed_assignee_id": string | null,
"series_id": string | null,
"starts_at": string,
"state": string,
"title": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "items"
        isOneToOne: true
        isSetofReturn: false
      } },
"after_member_left":
{ Args: { "circle_id": string }; Returns: undefined
                           },
"assign":
{ Args: { "assignee_id": string,"item_id": string,"version": number }; Returns: {
              "circle_id": string,
"created_at": string,
"created_by": string | null,
"ends_at": string | null,
"follow_up_of": string | null,
"id": string,
"kind": string,
"location": string | null,
"location_lat": number | null,
"location_lng": number | null,
"owner_id": string | null,
"private_notes": string | null,
"proposed_assignee_id": string | null,
"series_id": string | null,
"starts_at": string,
"state": string,
"title": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "items"
        isOneToOne: true
        isSetofReturn: false
      } },
"calendar_feed":
{ Args: Record<PropertyKey, never>; Returns: {
              "feed_tasks": boolean,"token": string
            }[]
                           },
"calendar_feed_for_token":
{ Args: { "token": string }; Returns: Json
                           },
"cancel_coverage":
{ Args: { "item_id": string,"version": number }; Returns: {
              "circle_id": string,
"created_at": string,
"created_by": string | null,
"ends_at": string | null,
"follow_up_of": string | null,
"id": string,
"kind": string,
"location": string | null,
"location_lat": number | null,
"location_lng": number | null,
"owner_id": string | null,
"private_notes": string | null,
"proposed_assignee_id": string | null,
"series_id": string | null,
"starts_at": string,
"state": string,
"title": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "items"
        isOneToOne: true
        isSetofReturn: false
      } },
"cancel_item":
{ Args: { "item_id": string,"version": number }; Returns: {
              "circle_id": string,
"created_at": string,
"created_by": string | null,
"ends_at": string | null,
"follow_up_of": string | null,
"id": string,
"kind": string,
"location": string | null,
"location_lat": number | null,
"location_lng": number | null,
"owner_id": string | null,
"private_notes": string | null,
"proposed_assignee_id": string | null,
"series_id": string | null,
"starts_at": string,
"state": string,
"title": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "items"
        isOneToOne: true
        isSetofReturn: false
      } },
"check_item_fields":
{ Args: { "ends_at": string,"location": string,"private_notes": string,"starts_at": string,"title": string }; Returns: undefined
                           },
"claim":
{ Args: { "item_id": string,"version": number }; Returns: {
              "circle_id": string,
"created_at": string,
"created_by": string | null,
"ends_at": string | null,
"follow_up_of": string | null,
"id": string,
"kind": string,
"location": string | null,
"location_lat": number | null,
"location_lng": number | null,
"owner_id": string | null,
"private_notes": string | null,
"proposed_assignee_id": string | null,
"series_id": string | null,
"starts_at": string,
"state": string,
"title": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "items"
        isOneToOne: true
        isSetofReturn: false
      } },
"clean_relationship":
{ Args: { "relationship": string }; Returns: string
                           },
"complete_item":
{ Args: { "item_id": string,"version": number }; Returns: {
              "circle_id": string,
"created_at": string,
"created_by": string | null,
"ends_at": string | null,
"follow_up_of": string | null,
"id": string,
"kind": string,
"location": string | null,
"location_lat": number | null,
"location_lng": number | null,
"owner_id": string | null,
"private_notes": string | null,
"proposed_assignee_id": string | null,
"series_id": string | null,
"starts_at": string,
"state": string,
"title": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "items"
        isOneToOne: true
        isSetofReturn: false
      } },
"coverage_remaining":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"coverage_used":
{ Args: { "as_of": string,"circle": string,"person": string }; Returns: number
                           },
"create_circle":
{ Args: { "care_recipient_name": string,"display_name"?: string,"relationship": string,"time_zone": string }; Returns: string
                           },
"create_invite":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"create_item":
{ Args: { "assignee_id"?: string,"ends_at"?: string,"follow_up_of"?: string,"kind": string,"location"?: string,"private_notes"?: string,"repeat"?: string,"starts_at": string,"title": string,"until"?: string }; Returns: string
                           },
"current_circle_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"decline_assignment":
{ Args: { "item_id": string,"version": number }; Returns: {
              "circle_id": string,
"created_at": string,
"created_by": string | null,
"ends_at": string | null,
"follow_up_of": string | null,
"id": string,
"kind": string,
"location": string | null,
"location_lat": number | null,
"location_lng": number | null,
"owner_id": string | null,
"private_notes": string | null,
"proposed_assignee_id": string | null,
"series_id": string | null,
"starts_at": string,
"state": string,
"title": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "items"
        isOneToOne: true
        isSetofReturn: false
      } },
"delete_push_subscription":
{ Args: { "endpoint": string }; Returns: undefined
                           },
"invite_preview":
{ Args: { "code": string }; Returns: {
              "care_recipient_name": string,"expires_at": string,"in_other_circle": boolean,"inviter_name": string,"is_member": boolean,"member_count": number,"member_names": (string)[]
            }[]
                           },
"is_circle_member":
{ Args: { "circle": string,"person": string }; Returns: boolean
                           },
"join_circle":
{ Args: { "code": string,"display_name"?: string,"relationship"?: string }; Returns: string
                           },
"join_demo_circle":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"leave_circle":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"lock_item":
{ Args: { "id": string }; Returns: {
              "circle_id": string,
"created_at": string,
"created_by": string | null,
"ends_at": string | null,
"follow_up_of": string | null,
"id": string,
"kind": string,
"location": string | null,
"location_lat": number | null,
"location_lng": number | null,
"owner_id": string | null,
"private_notes": string | null,
"proposed_assignee_id": string | null,
"series_id": string | null,
"starts_at": string,
"state": string,
"title": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "items"
        isOneToOne: true
        isSetofReturn: false
      } },
"lock_own_pending_request":
{ Args: { "item": string }; Returns: {
              "assignee_id": string | null,
"assigner_id": string | null,
"circle_id": string,
"created_at": string,
"id": string,
"item_id": string,
"resolved_at": string | null,
"scope": string,
"status": string
            }
                          SetofOptions: {
        from: "*"
        to: "assignment_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"log_item_event":
{ Args: { "actor": string,"data"?: Json,"event_type": string,"item": Database["public"]['Tables']["items"]['Row'] }; Returns: undefined
                           },
"log_share":
{ Args: { "item_id": string,"share_kind": string }; Returns: undefined
                           },
"mark_notifications_read":
{ Args: { "notification_id"?: number }; Returns: undefined
                           },
"name_detail":
{ Args: { "person": string }; Returns: string
                           },
"post_update":
{ Args: { "body": string,"item_id"?: string }; Returns: string
                           },
"queue_push":
{ Args: { "actor": string,"event": string,"item": Database["public"]['Tables']["items"]['Row'],"recipients": (string)[] }; Returns: undefined
                           },
"remove_member":
{ Args: { "member_id": string }; Returns: undefined
                           },
"request_coverage":
{ Args: { "item_id": string,"version": number }; Returns: {
              "circle_id": string,
"created_at": string,
"created_by": string | null,
"ends_at": string | null,
"follow_up_of": string | null,
"id": string,
"kind": string,
"location": string | null,
"location_lat": number | null,
"location_lng": number | null,
"owner_id": string | null,
"private_notes": string | null,
"proposed_assignee_id": string | null,
"series_id": string | null,
"starts_at": string,
"state": string,
"title": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "items"
        isOneToOne: true
        isSetofReturn: false
      } },
"reset_demo_circle":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"save_profile":
{ Args: { "display_name": string,"user_id": string }; Returns: undefined
                           },
"save_push_subscription":
{ Args: { "endpoint": string,"keys": Json }; Returns: undefined
                           },
"set_admin":
{ Args: { "member_id": string }; Returns: undefined
                           },
"set_calendar_feed_tasks":
{ Args: { "enabled": boolean }; Returns: {
              "feed_tasks": boolean,"token": string
            }[]
                           },
"update_item":
{ Args: { "item_id": string,"patch": Json,"version": number }; Returns: {
              "circle_id": string,
"created_at": string,
"created_by": string | null,
"ends_at": string | null,
"follow_up_of": string | null,
"id": string,
"kind": string,
"location": string | null,
"location_lat": number | null,
"location_lng": number | null,
"owner_id": string | null,
"private_notes": string | null,
"proposed_assignee_id": string | null,
"series_id": string | null,
"starts_at": string,
"state": string,
"title": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "items"
        isOneToOne: true
        isSetofReturn: false
      } },
"weekly_summary":
{ Args: { "week_start": string }; Returns: {
              "at": string,"count": number,"item_id": string,"item_title": string,"kind": string,"person_id": string
            }[]
                           },
"withdraw_assignment":
{ Args: { "item_id": string,"version": number }; Returns: {
              "circle_id": string,
"created_at": string,
"created_by": string | null,
"ends_at": string | null,
"follow_up_of": string | null,
"id": string,
"kind": string,
"location": string | null,
"location_lat": number | null,
"location_lng": number | null,
"owner_id": string | null,
"private_notes": string | null,
"proposed_assignee_id": string | null,
"series_id": string | null,
"starts_at": string,
"state": string,
"title": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "items"
        isOneToOne: true
        isSetofReturn: false
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
