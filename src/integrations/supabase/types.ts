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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcement_reads: {
        Row: {
          announcement_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          audience_function_id: string | null
          audience_kind: Database["public"]["Enums"]["announcement_audience_kind"]
          audience_team_id: string | null
          created_at: string
          created_by: string
          id: string
          message: string
          ministry_id: string
          priority: Database["public"]["Enums"]["announcement_priority"]
          scheduled_at: string | null
          title: string
        }
        Insert: {
          audience_function_id?: string | null
          audience_kind?: Database["public"]["Enums"]["announcement_audience_kind"]
          audience_team_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          message: string
          ministry_id: string
          priority?: Database["public"]["Enums"]["announcement_priority"]
          scheduled_at?: string | null
          title: string
        }
        Update: {
          audience_function_id?: string | null
          audience_kind?: Database["public"]["Enums"]["announcement_audience_kind"]
          audience_team_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          message?: string
          ministry_id?: string
          priority?: Database["public"]["Enums"]["announcement_priority"]
          scheduled_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_audience_function_id_fkey"
            columns: ["audience_function_id"]
            isOneToOne: false
            referencedRelation: "ministry_functions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_audience_team_id_fkey"
            columns: ["audience_team_id"]
            isOneToOne: false
            referencedRelation: "ministry_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          ministry_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          ministry_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          ministry_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      member_permissions: {
        Row: {
          function_ids: string[]
          member_id: string
          ministry_id: string
          overrides: Json
        }
        Insert: {
          function_ids?: string[]
          member_id: string
          ministry_id: string
          overrides?: Json
        }
        Update: {
          function_ids?: string[]
          member_id?: string
          ministry_id?: string
          overrides?: Json
        }
        Relationships: [
          {
            foreignKeyName: "member_permissions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "ministry_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_permissions_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      ministries: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          created_at: string
          default_permissions: Json
          description: string | null
          id: string
          invite_code: string
          invites_enabled: boolean
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          created_at?: string
          default_permissions?: Json
          description?: string | null
          id?: string
          invite_code: string
          invites_enabled?: boolean
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          created_at?: string
          default_permissions?: Json
          description?: string | null
          id?: string
          invite_code?: string
          invites_enabled?: boolean
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      ministry_functions: {
        Row: {
          active: boolean
          created_at: string
          icon: string | null
          id: string
          ministry_id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          ministry_id: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          ministry_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "ministry_functions_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      ministry_join_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          ministry_id: string
          status: Database["public"]["Enums"]["join_request_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          ministry_id: string
          status?: Database["public"]["Enums"]["join_request_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          ministry_id?: string
          status?: Database["public"]["Enums"]["join_request_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ministry_join_requests_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      ministry_members: {
        Row: {
          id: string
          joined_at: string
          ministry_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          ministry_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          ministry_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ministry_members_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      ministry_team_functions: {
        Row: {
          function_id: string
          team_id: string
        }
        Insert: {
          function_id: string
          team_id: string
        }
        Update: {
          function_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ministry_team_functions_function_id_fkey"
            columns: ["function_id"]
            isOneToOne: false
            referencedRelation: "ministry_functions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ministry_team_functions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "ministry_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      ministry_teams: {
        Row: {
          created_at: string
          id: string
          ministry_id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          ministry_id: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          ministry_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "ministry_teams_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          ministry_id: string | null
          read: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          ministry_id?: string | null
          read?: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          ministry_id?: string | null
          read?: boolean
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      schedule_agenda_items: {
        Row: {
          description: string | null
          id: string
          name: string
          position: number
          schedule_id: string
        }
        Insert: {
          description?: string | null
          id?: string
          name: string
          position?: number
          schedule_id: string
        }
        Update: {
          description?: string | null
          id?: string
          name?: string
          position?: number
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_agenda_items_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_assignments: {
        Row: {
          attended: boolean | null
          id: string
          label: string
          schedule_id: string
          status: Database["public"]["Enums"]["assignment_status"]
          user_id: string | null
        }
        Insert: {
          attended?: boolean | null
          id?: string
          label: string
          schedule_id: string
          status?: Database["public"]["Enums"]["assignment_status"]
          user_id?: string | null
        }
        Update: {
          attended?: boolean | null
          id?: string
          label?: string
          schedule_id?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_assignments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_history: {
        Row: {
          actor_id: string
          added_members: Json | null
          changes: Json | null
          created_at: string
          details: Json | null
          id: string
          kind: Database["public"]["Enums"]["schedule_history_kind"]
          ministry_id: string
          removed_members: Json | null
          schedule_date: string
          schedule_id: string
          summary: string | null
        }
        Insert: {
          actor_id: string
          added_members?: Json | null
          changes?: Json | null
          created_at?: string
          details?: Json | null
          id?: string
          kind: Database["public"]["Enums"]["schedule_history_kind"]
          ministry_id: string
          removed_members?: Json | null
          schedule_date: string
          schedule_id: string
          summary?: string | null
        }
        Update: {
          actor_id?: string
          added_members?: Json | null
          changes?: Json | null
          created_at?: string
          details?: Json | null
          id?: string
          kind?: Database["public"]["Enums"]["schedule_history_kind"]
          ministry_id?: string
          removed_members?: Json | null
          schedule_date?: string
          schedule_id?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_history_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_history_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          created_at: string
          created_by: string
          date: string
          description: string | null
          id: string
          ministry_id: string
          published: boolean
          require_confirmation: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          date: string
          description?: string | null
          id?: string
          ministry_id: string
          published?: boolean
          require_confirmation?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          date?: string
          description?: string | null
          id?: string
          ministry_id?: string
          published?: boolean
          require_confirmation?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      unavailabilities: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          ends_at: string
          id: string
          ministry_id: string
          starts_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          ends_at: string
          id?: string
          ministry_id: string
          starts_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          ends_at?: string
          id?: string
          ministry_id?: string
          starts_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unavailabilities_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          ministry_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ministry_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ministry_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_any_role: {
        Args: {
          _ministry_id: string
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _ministry_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_member_of: {
        Args: { _ministry_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      announcement_audience_kind: "all" | "admins" | "team" | "function"
      announcement_priority: "normal" | "important" | "urgent"
      app_role: "owner" | "admin" | "leader" | "member"
      assignment_status: "pending" | "confirmed" | "declined"
      join_request_status: "pending" | "approved" | "rejected"
      notification_type:
        | "joined_ministry"
        | "added_to_schedule"
        | "schedule_created"
        | "schedule_updated"
        | "join_request"
        | "join_request_approved"
        | "join_request_rejected"
      schedule_history_kind:
        | "created"
        | "updated"
        | "unavailability"
        | "attendance"
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
      announcement_audience_kind: ["all", "admins", "team", "function"],
      announcement_priority: ["normal", "important", "urgent"],
      app_role: ["owner", "admin", "leader", "member"],
      assignment_status: ["pending", "confirmed", "declined"],
      join_request_status: ["pending", "approved", "rejected"],
      notification_type: [
        "joined_ministry",
        "added_to_schedule",
        "schedule_created",
        "schedule_updated",
        "join_request",
        "join_request_approved",
        "join_request_rejected",
      ],
      schedule_history_kind: [
        "created",
        "updated",
        "unavailability",
        "attendance",
      ],
    },
  },
} as const
