export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      vacations: {
        Row: {
          id: string;
          title: string;
          type: "van" | "hotel" | "camping" | "other";
          region: string | null;
          description: string | null;
          start_date: string;
          end_date: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          type?: "van" | "hotel" | "camping" | "other";
          region?: string | null;
          description?: string | null;
          start_date: string;
          end_date: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          type?: "van" | "hotel" | "camping" | "other";
          region?: string | null;
          description?: string | null;
          start_date?: string;
          end_date?: string;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      vacation_members: {
        Row: {
          id: string;
          vacation_id: string;
          user_id: string | null;
          email: string;
          role: "admin" | "member";
          status: "invited" | "active";
          invited_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          vacation_id: string;
          user_id?: string | null;
          email: string;
          role?: "admin" | "member";
          status?: "invited" | "active";
          invited_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          vacation_id?: string;
          user_id?: string | null;
          email?: string;
          role?: "admin" | "member";
          status?: "invited" | "active";
          invited_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      spots: {
        Row: {
          id: string;
          vacation_id: string;
          name: string;
          category:
            | "stellplatz"
            | "sehenswuerdigkeit"
            | "ort"
            | "freizeit"
            | "versorgung";
          description: string | null;
          lat: number | null;
          lng: number | null;
          maps_url: string | null;
          info_url: string | null;
          image_url: string | null;
          image_manual: boolean;
          overnight_cost: "frei" | "kostenpflichtig" | null;
          price_hint: string | null;
          tags: string[];
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          vacation_id: string;
          name: string;
          category:
            | "stellplatz"
            | "sehenswuerdigkeit"
            | "ort"
            | "freizeit"
            | "versorgung";
          description?: string | null;
          lat?: number | null;
          lng?: number | null;
          maps_url?: string | null;
          info_url?: string | null;
          image_url?: string | null;
          image_manual?: boolean;
          overnight_cost?: "frei" | "kostenpflichtig" | null;
          price_hint?: string | null;
          tags?: string[];
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          vacation_id?: string;
          name?: string;
          category?:
            | "stellplatz"
            | "sehenswuerdigkeit"
            | "ort"
            | "freizeit"
            | "versorgung";
          description?: string | null;
          lat?: number | null;
          lng?: number | null;
          maps_url?: string | null;
          info_url?: string | null;
          image_url?: string | null;
          image_manual?: boolean;
          overnight_cost?: "frei" | "kostenpflichtig" | null;
          price_hint?: string | null;
          tags?: string[];
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      spot_ratings: {
        Row: {
          id: string;
          spot_id: string;
          user_id: string;
          rating: number | null;
          note: string | null;
          is_favorite: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          spot_id: string;
          user_id: string;
          rating?: number | null;
          note?: string | null;
          is_favorite?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          spot_id?: string;
          user_id?: string;
          rating?: number | null;
          note?: string | null;
          is_favorite?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      day_plans: {
        Row: {
          id: string;
          vacation_id: string;
          date: string;
          title: string | null;
          notes: string | null;
          overnight_spot_id: string | null;
        };
        Insert: {
          id?: string;
          vacation_id: string;
          date: string;
          title?: string | null;
          notes?: string | null;
          overnight_spot_id?: string | null;
        };
        Update: {
          id?: string;
          vacation_id?: string;
          date?: string;
          title?: string | null;
          notes?: string | null;
          overnight_spot_id?: string | null;
        };
        Relationships: [];
      };
      day_plan_spots: {
        Row: {
          id: string;
          day_plan_id: string;
          spot_id: string;
          position: number;
        };
        Insert: {
          id?: string;
          day_plan_id: string;
          spot_id: string;
          position?: number;
        };
        Update: {
          id?: string;
          day_plan_id?: string;
          spot_id?: string;
          position?: number;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_vacation_member: { Args: { p_vacation_id: string }; Returns: boolean };
      is_vacation_admin: { Args: { p_vacation_id: string }; Returns: boolean };
      is_spot_vacation_member: { Args: { p_spot_id: string }; Returns: boolean };
      is_day_plan_vacation_member: {
        Args: { p_day_plan_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      member_role: "admin" | "member";
      member_status: "invited" | "active";
      spot_category:
        | "stellplatz"
        | "sehenswuerdigkeit"
        | "ort"
        | "freizeit"
        | "versorgung";
      overnight_cost: "frei" | "kostenpflichtig";
      vacation_type: "van" | "hotel" | "camping" | "other";
    };
    CompositeTypes: Record<string, never>;
  };
};
