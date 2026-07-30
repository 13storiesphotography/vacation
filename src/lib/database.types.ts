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
          currency: string;
          budget_total: number | null;
          fuel_l_per_100km: number | null;
          fuel_price_per_liter: number | null;
          home_label: string | null;
          home_lat: number | null;
          home_lng: number | null;
          home_maps_url: string | null;
          include_home_in_route: boolean;
        };
        Insert: {
          id?: string;
          title: string;
          type?: "van" | "hotel" | "camping" | "other";
          region?: string | null;
          description?: string | null;
          start_date: string;
          end_date: string;
          created_by?: string;
          created_at?: string;
          currency?: string;
          budget_total?: number | null;
          fuel_l_per_100km?: number | null;
          fuel_price_per_liter?: number | null;
          home_label?: string | null;
          home_lat?: number | null;
          home_lng?: number | null;
          home_maps_url?: string | null;
          include_home_in_route?: boolean;
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
          currency?: string;
          budget_total?: number | null;
          fuel_l_per_100km?: number | null;
          fuel_price_per_liter?: number | null;
          home_label?: string | null;
          home_lat?: number | null;
          home_lng?: number | null;
          home_maps_url?: string | null;
          include_home_in_route?: boolean;
        };
        Relationships: [];
      };
      vacation_members: {
        Row: {
          id: string;
          vacation_id: string;
          user_id: string | null;
          email: string;
          role: "admin" | "custom" | "editor" | "viewer";
          status: "invited" | "active";
          invited_by: string | null;
          invite_token: string | null;
          invite_expires_at: string | null;
          can_manage_team: boolean;
          can_edit_vacation: boolean;
          can_edit_spots: boolean;
          can_edit_plan: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          vacation_id: string;
          user_id?: string | null;
          email: string;
          role?: "admin" | "custom" | "editor" | "viewer";
          status?: "invited" | "active";
          invited_by?: string | null;
          invite_token?: string | null;
          invite_expires_at?: string | null;
          can_manage_team?: boolean;
          can_edit_vacation?: boolean;
          can_edit_spots?: boolean;
          can_edit_plan?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          vacation_id?: string;
          user_id?: string | null;
          email?: string;
          role?: "admin" | "custom" | "editor" | "viewer";
          status?: "invited" | "active";
          invited_by?: string | null;
          invite_token?: string | null;
          invite_expires_at?: string | null;
          can_manage_team?: boolean;
          can_edit_vacation?: boolean;
          can_edit_spots?: boolean;
          can_edit_plan?: boolean;
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
            | "unterkunft"
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
          stay_check_in: string | null;
          stay_check_out: string | null;
          stay_nights: number | null;
          stay_status: "interessiert" | "gebucht" | null;
          tags: string[];
          is_relevant: boolean;
          price_per_night: number | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          vacation_id: string;
          name: string;
          category:
            | "stellplatz"
            | "unterkunft"
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
          stay_check_in?: string | null;
          stay_check_out?: string | null;
          stay_nights?: number | null;
          stay_status?: "interessiert" | "gebucht" | null;
          tags?: string[];
          is_relevant?: boolean;
          price_per_night?: number | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          vacation_id?: string;
          name?: string;
          category?:
            | "stellplatz"
            | "unterkunft"
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
          stay_check_in?: string | null;
          stay_check_out?: string | null;
          stay_nights?: number | null;
          stay_status?: "interessiert" | "gebucht" | null;
          tags?: string[];
          is_relevant?: boolean;
          price_per_night?: number | null;
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
          /** HH:MM[:SS] local clock — day start / leave morning origin. */
          depart_at: string | null;
        };
        Insert: {
          id?: string;
          vacation_id: string;
          date: string;
          title?: string | null;
          notes?: string | null;
          overnight_spot_id?: string | null;
          depart_at?: string | null;
        };
        Update: {
          id?: string;
          vacation_id?: string;
          date?: string;
          title?: string | null;
          notes?: string | null;
          overnight_spot_id?: string | null;
          depart_at?: string | null;
        };
        Relationships: [];
      };
      day_plan_spots: {
        Row: {
          id: string;
          day_plan_id: string;
          spot_id: string;
          position: number;
          /** Minutes on site; null = app default. */
          dwell_minutes: number | null;
        };
        Insert: {
          id?: string;
          day_plan_id: string;
          spot_id: string;
          position?: number;
          dwell_minutes?: number | null;
        };
        Update: {
          id?: string;
          day_plan_id?: string;
          spot_id?: string;
          position?: number;
          dwell_minutes?: number | null;
        };
        Relationships: [];
      };
      cost_items: {
        Row: {
          id: string;
          vacation_id: string;
          category:
            | "uebernachtung"
            | "anschaffung"
            | "sprit"
            | "maut"
            | "verpflegung"
            | "aktivitaet"
            | "sonstiges";
          title: string;
          amount: number;
          quantity: number;
          unit: string | null;
          status: "geplant" | "gebucht" | "bezahlt";
          notes: string | null;
          spot_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vacation_id: string;
          category?:
            | "uebernachtung"
            | "anschaffung"
            | "sprit"
            | "maut"
            | "verpflegung"
            | "aktivitaet"
            | "sonstiges";
          title: string;
          amount?: number;
          quantity?: number;
          unit?: string | null;
          status?: "geplant" | "gebucht" | "bezahlt";
          notes?: string | null;
          spot_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vacation_id?: string;
          category?:
            | "uebernachtung"
            | "anschaffung"
            | "sprit"
            | "maut"
            | "verpflegung"
            | "aktivitaet"
            | "sonstiges";
          title?: string;
          amount?: number;
          quantity?: number;
          unit?: string | null;
          status?: "geplant" | "gebucht" | "bezahlt";
          notes?: string | null;
          spot_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_vacation_member: { Args: { p_vacation_id: string }; Returns: boolean };
      is_vacation_admin: { Args: { p_vacation_id: string }; Returns: boolean };
      is_vacation_team_manager: { Args: { p_vacation_id: string }; Returns: boolean };
      is_vacation_settings_editor: { Args: { p_vacation_id: string }; Returns: boolean };
      is_vacation_spots_editor: { Args: { p_vacation_id: string }; Returns: boolean };
      is_vacation_plan_editor: { Args: { p_vacation_id: string }; Returns: boolean };
      is_vacation_editor: { Args: { p_vacation_id: string }; Returns: boolean };
      is_day_plan_vacation_editor: { Args: { p_day_plan_id: string }; Returns: boolean };
      get_vacation_invite: {
        Args: { p_token: string };
        Returns: {
          vacation_id: string;
          vacation_title: string;
          email: string;
          role: "admin" | "custom" | "editor" | "viewer";
          status: "invited" | "active";
          invite_expires_at: string | null;
        }[];
      };
      accept_vacation_invite: { Args: { p_token: string }; Returns: string };
      is_spot_vacation_member: { Args: { p_spot_id: string }; Returns: boolean };
      is_day_plan_vacation_member: {
        Args: { p_day_plan_id: string };
        Returns: boolean;
      };
      activate_my_vacation_invites: { Args: Record<string, never>; Returns: number };
    };
    Enums: {
      member_role: "admin" | "custom" | "editor" | "viewer";
      member_status: "invited" | "active";
      spot_category:
        | "stellplatz"
        | "unterkunft"
        | "sehenswuerdigkeit"
        | "ort"
        | "freizeit"
        | "versorgung";
      overnight_cost: "frei" | "kostenpflichtig";
      stay_status: "interessiert" | "gebucht";
      vacation_type: "van" | "hotel" | "camping" | "other";
      cost_category:
        | "uebernachtung"
        | "anschaffung"
        | "sprit"
        | "maut"
        | "verpflegung"
        | "aktivitaet"
        | "sonstiges";
      cost_status: "geplant" | "gebucht" | "bezahlt";
    };
    CompositeTypes: Record<string, never>;
  };
};
