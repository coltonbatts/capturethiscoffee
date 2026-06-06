import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderStatus, PersonType, ProductionStatus } from "./types";
import type {
  LabelPrintAttemptStatus,
  LabelPrintJobPayloadV1,
  LabelPrintJobStatus,
  LabelPrintTransport,
} from "./print-jobs";

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
      printer_devices: {
        Row: {
          id: string;
          staff_user_id: string;
          name: string;
          model: string | null;
          transport: string;
          native_identifier: string | null;
          last_seen_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          staff_user_id: string;
          name: string;
          model?: string | null;
          transport: string;
          native_identifier?: string | null;
          last_seen_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          staff_user_id?: string;
          name?: string;
          model?: string | null;
          transport?: string;
          native_identifier?: string | null;
          last_seen_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      label_print_jobs: {
        Row: {
          id: string;
          production_id: string | null;
          order_id: string | null;
          person_id: string | null;
          created_by: string;
          assigned_to: string | null;
          status: LabelPrintJobStatus;
          priority: number;
          payload: LabelPrintJobPayloadV1;
          rendered_png_path: string | null;
          printer_family: string;
          copies: number;
          claimed_at: string | null;
          printed_at: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          production_id?: string | null;
          order_id?: string | null;
          person_id?: string | null;
          created_by: string;
          assigned_to?: string | null;
          status?: LabelPrintJobStatus;
          priority?: number;
          payload: LabelPrintJobPayloadV1;
          rendered_png_path?: string | null;
          printer_family?: string;
          copies?: number;
          claimed_at?: string | null;
          printed_at?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          production_id?: string | null;
          order_id?: string | null;
          person_id?: string | null;
          created_by?: string;
          assigned_to?: string | null;
          status?: LabelPrintJobStatus;
          priority?: number;
          payload?: LabelPrintJobPayloadV1;
          rendered_png_path?: string | null;
          printer_family?: string;
          copies?: number;
          claimed_at?: string | null;
          printed_at?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "label_print_jobs_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "label_print_jobs_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "label_print_jobs_production_id_fkey";
            columns: ["production_id"];
            isOneToOne: false;
            referencedRelation: "productions";
            referencedColumns: ["id"];
          },
        ];
      };
      label_print_attempts: {
        Row: {
          id: string;
          job_id: string;
          staff_user_id: string;
          device_id: string | null;
          status: LabelPrintAttemptStatus;
          transport: LabelPrintTransport;
          printer_name: string | null;
          printer_identifier: string | null;
          sdk_version: string | null;
          error_code: string | null;
          error_message: string | null;
          started_at: string;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          job_id: string;
          staff_user_id: string;
          device_id?: string | null;
          status: LabelPrintAttemptStatus;
          transport: LabelPrintTransport;
          printer_name?: string | null;
          printer_identifier?: string | null;
          sdk_version?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          started_at?: string;
          finished_at?: string | null;
        };
        Update: {
          id?: string;
          job_id?: string;
          staff_user_id?: string;
          device_id?: string | null;
          status?: LabelPrintAttemptStatus;
          transport?: LabelPrintTransport;
          printer_name?: string | null;
          printer_identifier?: string | null;
          sdk_version?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          started_at?: string;
          finished_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "label_print_attempts_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "printer_devices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "label_print_attempts_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "label_print_jobs";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      complete_label_print_job: {
        Args: {
          p_job_id: string;
          p_attempt_id?: string | null;
        };
        Returns: Database["public"]["Tables"]["label_print_jobs"]["Row"];
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const enableAuth = process.env.NEXT_PUBLIC_ENABLE_AUTH;

export const isAuthDisabled = enableAuth === "false";
export const supabaseConfigError =
  !isAuthDisabled && (!supabaseUrl || !supabaseAnonKey)
    ? "Supabase auth is enabled by default. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, or set NEXT_PUBLIC_ENABLE_AUTH=false for local demo mode only."
    : "";

export const isSupabaseConfigured = Boolean(
  !supabaseConfigError && supabaseUrl && supabaseAnonKey && !isAuthDisabled,
);

let browserClient: SupabaseClient<Database> | null = null;

export function getSupabaseBrowserClient() {
  if (isAuthDisabled) return null;
  if (supabaseConfigError) throw new Error(supabaseConfigError);
  if (!supabaseUrl || !supabaseAnonKey) return null;

  browserClient ??= createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  return browserClient;
}
