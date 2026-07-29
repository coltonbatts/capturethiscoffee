import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSupabasePublicConfig } from "./supabase-config";
import type { OrderStatus, PersonType, ProductionStatus } from "./types";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          name: string;
          notes: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          notes?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          notes?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      people: {
        Row: {
          id: string;
          name: string;
          type: PersonType;
          role: string | null;
          department: string | null;
          company: string | null;
          photo_url: string | null;
          usual_order: string | null;
          dietary_notes: string | null;
          notes: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type?: PersonType;
          role?: string | null;
          department?: string | null;
          company?: string | null;
          photo_url?: string | null;
          usual_order?: string | null;
          dietary_notes?: string | null;
          notes?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: PersonType;
          role?: string | null;
          department?: string | null;
          company?: string | null;
          photo_url?: string | null;
          usual_order?: string | null;
          dietary_notes?: string | null;
          notes?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      client_people: {
        Row: {
          id: string;
          client_id: string;
          person_id: string;
          relationship_notes: string | null;
          active: boolean;
        };
        Insert: {
          id?: string;
          client_id: string;
          person_id: string;
          relationship_notes?: string | null;
          active?: boolean;
        };
        Update: {
          id?: string;
          client_id?: string;
          person_id?: string;
          relationship_notes?: string | null;
          active?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "client_people_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_people_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      productions: {
        Row: {
          id: string;
          name: string;
          client_id: string;
          shoot_date: string | null;
          location: string | null;
          runner_name: string | null;
          notes: string | null;
          status: ProductionStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          client_id: string;
          shoot_date?: string | null;
          location?: string | null;
          runner_name?: string | null;
          notes?: string | null;
          status?: ProductionStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          client_id?: string;
          shoot_date?: string | null;
          location?: string | null;
          runner_name?: string | null;
          notes?: string | null;
          status?: ProductionStatus;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "productions_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      production_share_tokens: {
        Row: {
          id: string;
          production_id: string;
          token_hash: string;
          label: string | null;
          expires_at: string | null;
          revoked_at: string | null;
          last_used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          production_id: string;
          token_hash: string;
          label?: string | null;
          expires_at?: string | null;
          revoked_at?: string | null;
          last_used_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          production_id?: string;
          token_hash?: string;
          label?: string | null;
          expires_at?: string | null;
          revoked_at?: string | null;
          last_used_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "production_share_tokens_production_id_fkey";
            columns: ["production_id"];
            isOneToOne: false;
            referencedRelation: "productions";
            referencedColumns: ["id"];
          },
        ];
      };
      production_roster: {
        Row: {
          id: string;
          production_id: string;
          person_id: string;
          group_label: string | null;
          on_set_today: boolean;
          sort_order: number;
        };
        Insert: {
          id?: string;
          production_id: string;
          person_id: string;
          group_label?: string | null;
          on_set_today?: boolean;
          sort_order?: number;
        };
        Update: {
          id?: string;
          production_id?: string;
          person_id?: string;
          group_label?: string | null;
          on_set_today?: boolean;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "production_roster_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "production_roster_production_id_fkey";
            columns: ["production_id"];
            isOneToOne: false;
            referencedRelation: "productions";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          production_id: string;
          roster_id: string;
          person_id: string;
          drink_type: string | null;
          size: string | null;
          temperature: string | null;
          milk_type: string | null;
          sweetener: string | null;
          caffeine: string | null;
          special_notes: string | null;
          vendor: string | null;
          status: OrderStatus;
          label_printed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          production_id: string;
          roster_id: string;
          person_id: string;
          drink_type?: string | null;
          size?: string | null;
          temperature?: string | null;
          milk_type?: string | null;
          sweetener?: string | null;
          caffeine?: string | null;
          special_notes?: string | null;
          vendor?: string | null;
          status?: OrderStatus;
          label_printed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          production_id?: string;
          roster_id?: string;
          person_id?: string;
          drink_type?: string | null;
          size?: string | null;
          temperature?: string | null;
          milk_type?: string | null;
          sweetener?: string | null;
          caffeine?: string | null;
          special_notes?: string | null;
          vendor?: string | null;
          status?: OrderStatus;
          label_printed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_production_id_fkey";
            columns: ["production_id"];
            isOneToOne: false;
            referencedRelation: "productions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_roster_id_fkey";
            columns: ["roster_id"];
            isOneToOne: false;
            referencedRelation: "production_roster";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_production_share_token: {
        Args: {
          p_production_id: string;
          p_expires_at?: string | null;
          p_label?: string | null;
        };
        Returns: string;
      };
      fetch_day_summaries: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          name: string;
          client_name: string;
          shoot_date: string | null;
          status: ProductionStatus;
          total: number;
          captured: number;
          skipped: number;
          printed: number;
        }[];
      };
      setup_add_person_to_roster: {
        Args: {
          p_production_id: string;
          p_person_id: string;
          p_group_label?: string | null;
          p_on_set_today?: boolean;
        };
        Returns: Json;
      };
      setup_bulk_add_roster: {
        Args: {
          p_production_id: string;
          p_people: Json;
        };
        Returns: Json;
      };
      setup_create_day: {
        Args: {
          p_name: string;
          p_client_id?: string | null;
          p_client_name?: string | null;
          p_shoot_date?: string | null;
          p_location?: string | null;
          p_runner_name?: string | null;
          p_notes?: string | null;
          p_status?: ProductionStatus;
          p_seed_default_roster?: boolean;
        };
        Returns: Json;
      };
      setup_create_person: {
        Args: {
          p_name: string;
          p_type?: PersonType;
          p_role?: string | null;
          p_department?: string | null;
          p_company?: string | null;
          p_photo_url?: string | null;
          p_usual_order?: string | null;
          p_dietary_notes?: string | null;
          p_notes?: string | null;
          p_active?: boolean;
        };
        Returns: Json;
      };
      setup_create_person_and_add_to_roster: {
        Args: {
          p_production_id: string;
          p_name: string;
          p_type?: PersonType;
          p_role?: string | null;
          p_department?: string | null;
          p_company?: string | null;
          p_photo_url?: string | null;
          p_usual_order?: string | null;
          p_dietary_notes?: string | null;
          p_notes?: string | null;
          p_group_label?: string | null;
          p_on_set_today?: boolean;
          p_link_to_client?: boolean;
        };
        Returns: Json;
      };
      setup_delete_planning_day: {
        Args: {
          p_production_id: string;
        };
        Returns: string;
      };
      setup_reorder_roster: {
        Args: {
          p_production_id: string;
          p_roster_ids: string[];
        };
        Returns: Json;
      };
      setup_update_day: {
        Args: {
          p_production_id: string;
          p_name: string;
          p_client_id?: string | null;
          p_client_name?: string | null;
          p_shoot_date?: string | null;
          p_location?: string | null;
          p_runner_name?: string | null;
          p_notes?: string | null;
          p_status?: ProductionStatus;
        };
        Returns: Json;
      };
      setup_update_person: {
        Args: {
          p_person_id: string;
          p_name: string;
          p_type?: PersonType;
          p_role?: string | null;
          p_department?: string | null;
          p_company?: string | null;
          p_photo_url?: string | null;
          p_usual_order?: string | null;
          p_dietary_notes?: string | null;
          p_notes?: string | null;
          p_active?: boolean;
        };
        Returns: Json;
      };
    };
    Enums: {
      person_type: PersonType;
      order_status: OrderStatus;
      production_status: ProductionStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

const publicConfig = resolveSupabasePublicConfig(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export const supabaseConfigError = publicConfig.error;
export const isSupabaseConfigured = publicConfig.status === "configured";

let browserClient: SupabaseClient<Database> | null = null;

export function getSupabaseBrowserClient() {
  if (publicConfig.status === "error") {
    throw new Error(publicConfig.error);
  }

  browserClient ??= createBrowserClient<Database>(
    publicConfig.url,
    publicConfig.anonKey,
  );
  return browserClient;
}
