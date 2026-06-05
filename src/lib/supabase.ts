import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderStatus, PersonType, ProductionStatus } from "./types";

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
    Functions: Record<string, never>;
    Enums: {
      person_type: PersonType;
      order_status: OrderStatus;
      production_status: ProductionStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const isAuthDisabled =
  process.env.NEXT_PUBLIC_ENABLE_AUTH !== "true";

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && !isAuthDisabled,
);

let browserClient: SupabaseClient<Database> | null = null;

export function getSupabaseBrowserClient() {
  if (isAuthDisabled) return null;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  browserClient ??= createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  return browserClient;
}
