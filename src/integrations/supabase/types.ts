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
      blackouts: {
        Row: {
          ends_at: string
          id: string
          reason: string | null
          resource_id: string | null
          starts_at: string
          venue_id: string
        }
        Insert: {
          ends_at: string
          id?: string
          reason?: string | null
          resource_id?: string | null
          starts_at: string
          venue_id: string
        }
        Update: {
          ends_at?: string
          id?: string
          reason?: string | null
          resource_id?: string | null
          starts_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blackouts_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blackouts_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_resources: {
        Row: {
          booking_id: string
          ends_at: string
          resource_id: string
          starts_at: string
          status: string
        }
        Insert: {
          booking_id: string
          ends_at: string
          resource_id: string
          starts_at: string
          status?: string
        }
        Update: {
          booking_id?: string
          ends_at?: string
          resource_id?: string
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_resources_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_resources_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          players: number
          reference: string
          service_fee_pence: number
          starts_at: string
          status: string
          total_pence: number
          user_id: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          players?: number
          reference: string
          service_fee_pence?: number
          starts_at: string
          status?: string
          total_pence?: number
          user_id: string
          venue_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          players?: number
          reference?: string
          service_fee_pence?: number
          starts_at?: string
          status?: string
          total_pence?: number
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_hours: {
        Row: {
          close_min: number
          day_of_week: number
          id: string
          open_min: number
          venue_id: string
        }
        Insert: {
          close_min: number
          day_of_week: number
          id?: string
          open_min: number
          venue_id: string
        }
        Update: {
          close_min?: number
          day_of_week?: number
          id?: string
          open_min?: number
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opening_hours_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          day_of_week: number
          end_min: number
          id: string
          min_duration_min: number
          price_per_hour_pence: number
          slot_step_min: number
          start_min: number
          venue_id: string
        }
        Insert: {
          day_of_week: number
          end_min: number
          id?: string
          min_duration_min?: number
          price_per_hour_pence: number
          slot_step_min?: number
          start_min: number
          venue_id: string
        }
        Update: {
          day_of_week?: number
          end_min?: number
          id?: string
          min_duration_min?: number
          price_per_hour_pence?: number
          slot_step_min?: number
          start_min?: number
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      resources: {
        Row: {
          id: string
          is_active: boolean
          kind: string
          name: string
          sort_order: number
          venue_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          kind: string
          name: string
          sort_order?: number
          venue_id: string
        }
        Update: {
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          sort_order?: number
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venue_images: {
        Row: {
          id: string
          sort_order: number
          url: string
          venue_id: string
        }
        Insert: {
          id?: string
          sort_order?: number
          url: string
          venue_id: string
        }
        Update: {
          id?: string
          sort_order?: number
          url?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_images_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          activity: string
          address: string | null
          city: string | null
          cover_image: string | null
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          lat: number | null
          lng: number | null
          name: string
          slug: string
          type: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          activity: string
          address?: string | null
          city?: string | null
          cover_image?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          slug: string
          type: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          activity?: string
          address?: string | null
          city?: string | null
          cover_image?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          lat?: number | null
          lng?: number | null
          name?: string
          slug?: string
          type?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_booking: { Args: { _booking_id: string }; Returns: undefined }
      claim_vendor_role: { Args: never; Returns: undefined }
      create_booking: {
        Args: {
          _ends_at: string
          _players: number
          _resource_ids: string[]
          _service_fee_pence: number
          _starts_at: string
          _total_pence: number
          _venue_id: string
        }
        Returns: {
          id: string
          reference: string
        }[]
      }
      gen_booking_reference: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "customer" | "vendor" | "admin"
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
      app_role: ["customer", "vendor", "admin"],
    },
  },
} as const
