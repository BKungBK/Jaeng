
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
            "admin_areas": {
                  Row: {
                    "geom": unknown,"id": number,"level": number,"name_en": string,"name_th": string,"pcode": string,"province_th": string,"region": string
                  }
                  ComputedFields: never
                  Insert: {
                    "geom": unknown,"id"?: number,"level": number,"name_en": string,"name_th": string,"pcode": string,"province_th": string,"region": string
                  }
                  Update: {
                    "geom"?: unknown,"id"?: number,"level"?: number,"name_en"?: string,"name_th"?: string,"pcode"?: string,"province_th"?: string,"region"?: string
                  }
                  Relationships: [
                    
                  ]
                },"categories": {
                  Row: {
                    "default_level": number,"icon": string,"id": number,"name_en": string,"name_th": string,"slug": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "default_level": number,"icon": string,"id": number,"name_en": string,"name_th": string,"slug": string,"sort": number
                  }
                  Update: {
                    "default_level"?: number,"icon"?: string,"id"?: number,"name_en"?: string,"name_th"?: string,"slug"?: string,"sort"?: number
                  }
                  Relationships: [
                    
                  ]
                },"comments": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"id": string,"photo_id": string | null,"report_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"created_at"?: string,"id"?: string,"photo_id"?: string | null,"report_id": string,"status"?: string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"id"?: string,"photo_id"?: string | null,"report_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_photo_id_fkey"
      columns: ["photo_id"]
isOneToOne: false
      referencedRelation: "report_photos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "public_reports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "reports"
      referencedColumns: ["id"]
    }
                  ]
                },"confirmations": {
                  Row: {
                    "created_at": string,"report_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"report_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"report_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "confirmations_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "public_reports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "confirmations_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "reports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "confirmations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"fix_claims": {
                  Row: {
                    "claimant_id": string,"created_at": string,"id": string,"note": string | null,"photo_id": string | null,"report_id": string,"reviewed_at": string | null,"reviewed_by": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "claimant_id": string,"created_at"?: string,"id"?: string,"note"?: string | null,"photo_id"?: string | null,"report_id": string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: string
                  }
                  Update: {
                    "claimant_id"?: string,"created_at"?: string,"id"?: string,"note"?: string | null,"photo_id"?: string | null,"report_id"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fix_claims_claimant_id_fkey"
      columns: ["claimant_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fix_claims_photo_id_fkey"
      columns: ["photo_id"]
isOneToOne: false
      referencedRelation: "report_photos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fix_claims_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "public_reports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fix_claims_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "reports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fix_claims_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"flags": {
                  Row: {
                    "created_at": string,"id": string,"note": string | null,"reason": string,"reporter_id": string,"status": string,"target_id": string,"target_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"note"?: string | null,"reason": string,"reporter_id": string,"status"?: string,"target_id": string,"target_type": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"note"?: string | null,"reason"?: string,"reporter_id"?: string,"status"?: string,"target_id"?: string,"target_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "flags_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"moderation_log": {
                  Row: {
                    "action": string,"admin_id": string | null,"created_at": string,"detail": NonNullable<Json>,"id": number,"target_id": string | null,"target_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"admin_id"?: string | null,"created_at"?: string,"detail"?: NonNullable<Json>,"id"?: number,"target_id"?: string | null,"target_type": string
                  }
                  Update: {
                    "action"?: string,"admin_id"?: string | null,"created_at"?: string,"detail"?: NonNullable<Json>,"id"?: number,"target_id"?: string | null,"target_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "moderation_log_admin_id_fkey"
      columns: ["admin_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "banned_at": string | null,"created_at": string,"display_name": string,"id": string,"locale": string,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "banned_at"?: string | null,"created_at"?: string,"display_name": string,"id": string,"locale"?: string,"role"?: string
                  }
                  Update: {
                    "banned_at"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string,"locale"?: string,"role"?: string
                  }
                  Relationships: [
                    
                  ]
                },"report_photos": {
                  Row: {
                    "blurred": boolean,"created_at": string,"height": number | null,"id": string,"kind": string,"report_id": string | null,"storage_path": string,"uploader_id": string,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "blurred"?: boolean,"created_at"?: string,"height"?: number | null,"id"?: string,"kind"?: string,"report_id"?: string | null,"storage_path": string,"uploader_id": string,"width"?: number | null
                  }
                  Update: {
                    "blurred"?: boolean,"created_at"?: string,"height"?: number | null,"id"?: string,"kind"?: string,"report_id"?: string | null,"storage_path"?: string,"uploader_id"?: string,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "report_photos_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "public_reports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "report_photos_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "reports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "report_photos_uploader_id_fkey"
      columns: ["uploader_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"report_tags": {
                  Row: {
                    "report_id": string,"tag_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "report_id": string,"tag_id": number
                  }
                  Update: {
                    "report_id"?: string,"tag_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "report_tags_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "public_reports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "report_tags_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "reports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "report_tags_tag_id_fkey"
      columns: ["tag_id"]
isOneToOne: false
      referencedRelation: "tags"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "approved_at": string | null,"author_id": string,"category_id": number,"comment_count": number,"confirm_count": number,"created_at": string,"danger_level": number,"description": string | null,"hidden_from": string | null,"hide_author": boolean,"id": string,"location": unknown,"place_name": string | null,"profanity_flag": boolean,"public_location": unknown,"reject_reason": string | null,"resolved_at": string | null,"status": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_at"?: string | null,"author_id": string,"category_id": number,"comment_count"?: number,"confirm_count"?: number,"created_at"?: string,"danger_level": number,"description"?: string | null,"hidden_from"?: string | null,"hide_author"?: boolean,"id"?: string,"location": unknown,"place_name"?: string | null,"profanity_flag"?: boolean,"public_location": unknown,"reject_reason"?: string | null,"resolved_at"?: string | null,"status"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "approved_at"?: string | null,"author_id"?: string,"category_id"?: number,"comment_count"?: number,"confirm_count"?: number,"created_at"?: string,"danger_level"?: number,"description"?: string | null,"hidden_from"?: string | null,"hide_author"?: boolean,"id"?: string,"location"?: unknown,"place_name"?: string | null,"profanity_flag"?: boolean,"public_location"?: unknown,"reject_reason"?: string | null,"resolved_at"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"tags": {
                  Row: {
                    "id": number,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: number,"name": string
                  }
                  Update: {
                    "id"?: number,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "public_comments": {
                  Row: {
                    "author_name": string | null,"body": string | null,"by_reporter": boolean | null,"created_at": string | null,"id": string | null,"photo_path": string | null,"report_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "comments_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "public_reports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "reports"
      referencedColumns: ["id"]
    }
                  ]
                },"public_reports": {
                  Row: {
                    "approved_at": string | null,"author_name": string | null,"category": string | null,"comment_count": number | null,"confirm_count": number | null,"cover_photo_path": string | null,"created_at": string | null,"danger_level": number | null,"days_open": number | null,"description": string | null,"icon": string | null,"id": string | null,"lat": number | null,"lng": number | null,"photos": Json | null,"place_name": string | null,"resolved_at": string | null,"status": string | null,"tags": (string)[] | null,"title": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "add_comment":
{ Args: { "p_body": string,"p_limit": number,"p_photo"?: string,"p_report": string,"p_user": string }; Returns: {
              "comment_count": number,"comment_id": string,"confirm_count": number,"status": string
            }[]
                           },
"admin_approve_report":
{ Args: { "p_admin": string,"p_category": string,"p_danger": number,"p_lat": number,"p_lng": number,"p_location_mode": string,"p_report": string,"p_title": string }; Returns: Json
                           },
"admin_hide":
{ Args: { "p_admin": string,"p_target_id": string,"p_target_type": string }; Returns: Json
                           },
"admin_reject_report":
{ Args: { "p_admin": string,"p_note": string,"p_reason": string,"p_report": string }; Returns: Json
                           },
"admin_resolve_flags":
{ Args: { "p_action": string,"p_admin": string,"p_flag": string }; Returns: Json
                           },
"admin_restore":
{ Args: { "p_admin": string,"p_target_id": string,"p_target_type": string }; Returns: Json
                           },
"admin_review_fix_claim":
{ Args: { "p_admin": string,"p_approve": boolean,"p_claim": string }; Returns: Json
                           },
"admin_set_ban":
{ Args: { "p_admin": string,"p_banned": boolean,"p_user": string }; Returns: Json
                           },
"area_name_at":
{ Args: { "lat": number,"lng": number }; Returns: string
                           },
"area_province_at":
{ Args: { "lat": number,"lng": number }; Returns: string
                           },
"claim_photos":
{ Args: { "p_photo_ids": (string)[],"p_user": string }; Returns: undefined
                           },
"create_fix_claim":
{ Args: { "p_limit": number,"p_note": string,"p_photo": string,"p_report": string,"p_user": string }; Returns: Json
                           },
"create_flag":
{ Args: { "p_limit": number,"p_note": string,"p_reason": string,"p_target_id": string,"p_target_type": string,"p_user": string }; Returns: Json
                           },
"create_report":
{ Args: { "p_category": string,"p_danger": number,"p_description": string,"p_flagged": boolean,"p_hide_author": boolean,"p_lat": number,"p_limit": number,"p_lng": number,"p_photo_ids": (string)[],"p_tags": (string)[],"p_title": string,"p_user": string }; Returns: {
              "id": string,"status": string
            }[]
                           },
"delete_orphan_photos":
{ Args: { "p_older_than": string }; Returns: {
              "id": string,"storage_path": string
            }[]
                           },
"escape_like":
{ Args: { "s": string }; Returns: string
                           },
"find_duplicates":
{ Args: { "p_category": string,"p_lat": number,"p_lng": number,"p_radius"?: number }; Returns: {
              "category": string,"confirm_count": number,"cover_photo_path": string,"danger_level": number,"id": string,"status": string,"title": string
            }[]
                           },
"fuzz_point":
{ Args: { "max_m": number,"p": unknown }; Returns: unknown
                           },
"hide_target":
{ Args: { "p_action": string,"p_admin": string,"p_target_id": string,"p_target_type": string }; Returns: Json
                           },
"lock_profile":
{ Args: { "p_user": string }; Returns: undefined
                           },
"log_action":
{ Args: { "p_action": string,"p_admin": string,"p_detail"?: Json,"p_target_id": string,"p_target_type": string }; Returns: undefined
                           },
"merge_duplicate":
{ Args: { "p_limit": number,"p_photo_ids": (string)[],"p_target": string,"p_user": string }; Returns: {
              "comment_count": number,"comment_id": string,"confirm_count": number,"confirmed": boolean,"moved": Json,"status": string
            }[]
                           },
"merge_hash_tags":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"moderation_effect":
{ Args: { "p_demote"?: Json,"p_promote"?: Json,"p_report": string }; Returns: Json
                           },
"register_photo":
{ Args: { "p_blurred": boolean,"p_height": number,"p_id": string,"p_limit": number,"p_path": string,"p_uploader": string,"p_width": number }; Returns: undefined
                           },
"report_public_paths":
{ Args: { "p_report": string }; Returns: Json
                           },
"reports_in_bbox":
{ Args: { "categories"?: (string)[],"levels"?: (number)[],"max_lat": number,"max_lng": number,"min_lat": number,"min_lng": number,"q"?: string,"statuses"?: (string)[] }; Returns: Json
                           },
"stats_in_bbox":
{ Args: { "max_lat": number,"max_lng": number,"min_lat": number,"min_lng": number }; Returns: {
              "open_count": number,"resolved_this_month": number
            }[]
                           },
"suggest_tags":
{ Args: { "max_rows"?: number,"q": string }; Returns: string[]
                           },
"toggle_confirmation":
{ Args: { "p_report": string,"p_user": string }; Returns: {
              "comment_count": number,"confirm_count": number,"confirmed": boolean,"status": string
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
