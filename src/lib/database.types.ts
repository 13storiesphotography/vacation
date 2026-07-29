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
          role: "admin" | "editor" | "viewer";
          status: "invited" | "active";
          invited_by: string | null;
          invite_token: string | null;
          invite_expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          vacation_id: string;
          user_id?: string | null;
          email: string;
          role?: "admin" | "editor" | "viewer";
          status?: "invited" | "active";
          invited_by?: string | null;
          invite_token?: string | null;
          invite_expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          vacation_id?: string;
          user_id?: string | null;
          email?: string;
          role?: "admin" | "editor" | "viewer";
          status?: "invited" | "active";
          invited_by?: string | null;
          invite_token?: string | null;
          invite_expires_at?: string | null;
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
          overnight_cost?: "frei" | "kostenpflichtig" | null;
          price_hint?: string | null;
          tags?: string[];
          created_by?: string | null;
          created_at?: string;
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
      is_vacation_editor: { Args: { p_vacation_id: string }; Returns: boolean };
      is_day_plan_vacation_editor: { Args: { p_day_plan_id: string }; Returns: boolean };
      get_vacation_invite: {
        Args: { p_token: string };
        Returns: {
          vacation_id: string;
          vacation_title: string;
          email: string;
          role: "admin" | "editor" | "viewer";
          status: "invited" | "active";
          invite_expires_at: string | null;
        }[];
      };
      accept_vacation_invite: { Args: { p_token: string }; Returns: string };
    };
    Enums: {
      member_role: "admin" | "editor" | "viewer";
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
