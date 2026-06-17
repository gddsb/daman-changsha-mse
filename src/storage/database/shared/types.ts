/**
 * Supabase Database 类型定义（手动维护）
 * 与 src/storage/database/shared/schema.ts 保持列级一致
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      workshops: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workshops"]["Insert"]>;
        Relationships: [];
      };
      production_lines: {
        Row: {
          id: string;
          code: string;
          name: string;
          workshop_code: string;
          workshop_name: string;
          status: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          workshop_code: string;
          workshop_name: string;
          status?: string;
          description?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["production_lines"]["Insert"]>;
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          code: string;
          name: string;
          specification: string | null;
          unit: string | null;
          process_route: string | null;
          source: string;
          synced_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          specification?: string | null;
          unit?: string | null;
          process_route?: string | null;
          source?: string;
          synced_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
        Relationships: [];
      };
      u9_sales_orders: {
        Row: {
          id: string;
          sales_order_no: string;
          customer_code: string | null;
          customer_name: string;
          product_code: string;
          product_name: string;
          specification: string | null;
          quantity: number;
          unit: string | null;
          delivery_date: string | null;
          status: string;
          synced_at: string;
        };
        Insert: {
          id?: string;
          sales_order_no: string;
          customer_code?: string | null;
          customer_name: string;
          product_code: string;
          product_name: string;
          specification?: string | null;
          quantity: number;
          unit?: string | null;
          delivery_date?: string | null;
          status?: string;
          synced_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["u9_sales_orders"]["Insert"]>;
        Relationships: [];
      };
      work_orders: {
        Row: {
          id: string;
          order_no: string;
          order_type: string;
          sales_order_no: string | null;
          product_code: string;
          product_name: string;
          specification: string | null;
          unit: string;
          planned_quantity: number;
          completed_quantity: number;
          scrap_quantity: number;
          status: string;
          priority: number;
          workshop_code: string | null;
          workshop_name: string | null;
          line_code: string | null;
          line_name: string | null;
          customer_name: string | null;
          planned_start_date: string | null;
          planned_end_date: string | null;
          actual_start_date: string | null;
          actual_end_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_no: string;
          order_type?: string;
          sales_order_no?: string | null;
          product_code: string;
          product_name: string;
          specification?: string | null;
          unit?: string;
          planned_quantity: number;
          completed_quantity?: number;
          scrap_quantity?: number;
          status?: string;
          priority?: number;
          workshop_code?: string | null;
          workshop_name?: string | null;
          line_code?: string | null;
          line_name?: string | null;
          customer_name?: string | null;
          planned_start_date?: string | null;
          planned_end_date?: string | null;
          actual_start_date?: string | null;
          actual_end_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["work_orders"]["Insert"]>;
        Relationships: [];
      };
      work_order_operations: {
        Row: {
          id: string;
          work_order_id: string;
          sequence: number;
          operation_name: string;
          workstation: string | null;
          line_code: string | null;
          line_name: string | null;
          equipment_code: string | null;
          standard_time_minutes: number | null;
          status: string;
          operator_name: string | null;
          good_quantity: number;
          scrap_quantity: number;
          start_time: string | null;
          end_time: string | null;
        };
        Insert: {
          id?: string;
          work_order_id: string;
          sequence: number;
          operation_name: string;
          workstation?: string | null;
          line_code?: string | null;
          line_name?: string | null;
          equipment_code?: string | null;
          standard_time_minutes?: number | null;
          status?: string;
          operator_name?: string | null;
          good_quantity?: number;
          scrap_quantity?: number;
          start_time?: string | null;
          end_time?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["work_order_operations"]["Insert"]>;
        Relationships: [];
      };
      work_order_reports: {
        Row: {
          id: string;
          work_order_id: string;
          operation_id: string | null;
          work_order_no: string;
          process_name: string;
          line_code: string;
          line_name: string;
          shift_no: string;
          product_code: string;
          product_name: string;
          can_spec: string | null;
          can_height: number | null;
          batch_no: string | null;
          inspector_name: string;
          good_quantity: number;
          scrap_quantity: number;
          scrap_reason: string | null;
          reported_at: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          work_order_id: string;
          operation_id?: string | null;
          work_order_no: string;
          process_name: string;
          line_code: string;
          line_name: string;
          shift_no?: string;
          product_code: string;
          product_name: string;
          can_spec?: string | null;
          can_height?: number | null;
          batch_no?: string | null;
          inspector_name: string;
          good_quantity?: number;
          scrap_quantity?: number;
          scrap_reason?: string | null;
          reported_at?: string;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["work_order_reports"]["Insert"]>;
        Relationships: [];
      };
      production_plans: {
        Row: {
          id: string;
          plan_date: string;
          line_code: string;
          line_name: string;
          work_order_id: string;
          work_order_no: string;
          product_code: string;
          product_name: string;
          planned_quantity: number;
          priority: number;
          status: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plan_date: string;
          line_code: string;
          line_name: string;
          work_order_id: string;
          work_order_no: string;
          product_code: string;
          product_name: string;
          planned_quantity: number;
          priority?: number;
          status?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["production_plans"]["Insert"]>;
        Relationships: [];
      };
      equipment: {
        Row: {
          id: string;
          code: string;
          name: string;
          type: string;
          model: string | null;
          manufacturer: string | null;
          workshop_code: string | null;
          workshop_name: string | null;
          line_code: string | null;
          line_name: string | null;
          status: string;
          current_work_order_no: string | null;
          last_maintenance_date: string | null;
          next_maintenance_date: string | null;
          oee_target: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          type: string;
          model?: string | null;
          manufacturer?: string | null;
          workshop_code?: string | null;
          workshop_name?: string | null;
          line_code?: string | null;
          line_name?: string | null;
          status?: string;
          current_work_order_no?: string | null;
          last_maintenance_date?: string | null;
          next_maintenance_date?: string | null;
          oee_target?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["equipment"]["Insert"]>;
        Relationships: [];
      };
      equipment_oee: {
        Row: {
          id: string;
          equipment_code: string;
          record_date: string;
          planned_time_minutes: number;
          run_time_minutes: number;
          downtime_minutes: number;
          good_quantity: number;
          total_quantity: number;
          availability: string | null;
          performance: string | null;
          quality: string | null;
          oee: string | null;
        };
        Insert: {
          id?: string;
          equipment_code: string;
          record_date: string;
          planned_time_minutes?: number;
          run_time_minutes?: number;
          downtime_minutes?: number;
          good_quantity?: number;
          total_quantity?: number;
          availability?: string | null;
          performance?: string | null;
          quality?: string | null;
          oee?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["equipment_oee"]["Insert"]>;
        Relationships: [];
      };
      equipment_maintenance: {
        Row: {
          id: string;
          equipment_code: string;
          equipment_name: string;
          maintenance_type: string;
          planned_date: string;
          completed_date: string | null;
          operator_name: string | null;
          status: string;
          description: string | null;
          cost: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          equipment_code: string;
          equipment_name: string;
          maintenance_type: string;
          planned_date: string;
          completed_date?: string | null;
          operator_name?: string | null;
          status?: string;
          description?: string | null;
          cost?: string | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["equipment_maintenance"]["Insert"]>;
        Relationships: [];
      };
      defect_codes: {
        Row: {
          id: string;
          code: string;
          name: string;
          category: string;
          severity: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          category: string;
          severity?: string;
        };
        Update: Partial<Database["public"]["Tables"]["defect_codes"]["Insert"]>;
        Relationships: [];
      };
      quality_inspections: {
        Row: {
          id: string;
          inspection_no: string;
          work_order_id: string | null;
          work_order_no: string | null;
          inspection_type: string;
          product_code: string;
          product_name: string;
          can_spec: string | null;
          can_height: number | null;
          batch_no: string | null;
          process_name: string | null;
          line_code: string | null;
          line_name: string | null;
          shift_no: string | null;
          inspector_name: string;
          inspection_time: string;
          sample_size: number;
          result: string;
          pass_quantity: number | null;
          fail_quantity: number | null;
          defect_code: string | null;
          defect_description: string | null;
          measurements: Json | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          inspection_no: string;
          work_order_id?: string | null;
          work_order_no?: string | null;
          inspection_type: string;
          product_code: string;
          product_name: string;
          can_spec?: string | null;
          can_height?: number | null;
          batch_no?: string | null;
          process_name?: string | null;
          line_code?: string | null;
          line_name?: string | null;
          shift_no?: string | null;
          inspector_name: string;
          inspection_time?: string;
          sample_size?: number;
          result?: string;
          defect_code?: string | null;
          defect_description?: string | null;
          measurements?: Json | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["quality_inspections"]["Insert"]>;
        Relationships: [];
      };
      daily_quality_reports: {
        Row: {
          id: string;
          report_date: string;
          line_code: string;
          line_name: string;
          process_name: string;
          product_code: string;
          product_name: string;
          can_spec: string | null;
          can_height: number | null;
          shift_no: string | null;
          total_inspected: number;
          total_good: number;
          total_scrap: number;
          pass_rate: string | null;
          scrap_rate: string | null;
          defect_breakdown: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_date: string;
          line_code: string;
          line_name: string;
          process_name: string;
          product_code: string;
          product_name: string;
          can_spec?: string | null;
          can_height?: number | null;
          shift_no?: string | null;
          total_inspected?: number;
          total_good?: number;
          total_scrap?: number;
          pass_rate?: string | null;
          scrap_rate?: string | null;
          defect_breakdown?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["daily_quality_reports"]["Insert"]>;
        Relationships: [];
      };
      health_check: {
        Row: {
          id: number;
          updated_at: string | null;
        };
        Insert: {
          id?: number;
          updated_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["health_check"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
