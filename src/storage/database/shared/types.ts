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
          delivery_date?: string | null;
          status: string;
          synced_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["u9_sales_orders"]["Insert"]>;
        Relationships: [];
      };
      work_orders: {
        Row: {
          id: string;
          order_no: string;
          sales_order_no: string | null;
          product_code: string;
          product_name: string;
          specification: string | null;
          planned_quantity: number;
          completed_quantity: number;
          scrap_quantity: number;
          status: string;
          priority: number;
          workshop_code: string | null;
          workshop_name: string | null;
          customer_name: string | null;
          planned_start_date: string | null;
          planned_end_date: string | null;
          actual_start_date: string | null;
          actual_end_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["work_orders"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["work_orders"]["Row"]>;
        Relationships: [];
      };
      work_order_operations: {
        Row: {
          id: string;
          work_order_id: string;
          sequence: number;
          operation_name: string;
          equipment_code: string | null;
          equipment_name: string | null;
          standard_time_minutes: number | null;
          status: string;
          operator_name: string | null;
          start_time: string | null;
          end_time: string | null;
          good_quantity: number;
          scrap_quantity: number;
          notes: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["work_order_operations"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["work_order_operations"]["Row"]>;
        Relationships: [];
      };
      work_order_reports: {
        Row: {
          id: string;
          work_order_id: string;
          operation_id: string | null;
          report_type: string;
          operator_name: string;
          good_quantity: number;
          scrap_quantity: number;
          scrap_reason: string | null;
          reported_at: string;
          notes: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["work_order_reports"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["work_order_reports"]["Row"]>;
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
          status: string;
          current_work_order_no: string | null;
          current_operator: string | null;
          last_maintenance_date: string | null;
          next_maintenance_date: string | null;
          oee_target: string | null;
          purchase_date: string | null;
          notes: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["equipment"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["equipment"]["Row"]>;
        Relationships: [];
      };
      equipment_oee: {
        Row: {
          id: string;
          equipment_code: string;
          equipment_name: string;
          record_date: string;
          planned_time_minutes: number;
          run_time_minutes: number;
          downtime_minutes: number;
          good_quantity: number;
          total_quantity: number;
          availability: string;
          performance: string;
          quality: string;
          oee: string;
        };
        Insert: Partial<Database["public"]["Tables"]["equipment_oee"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["equipment_oee"]["Row"]>;
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
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["equipment_maintenance"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["equipment_maintenance"]["Row"]>;
        Relationships: [];
      };
      defect_codes: {
        Row: {
          id: string;
          code: string;
          name: string;
          category: string;
          severity: string;
          description: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["defect_codes"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["defect_codes"]["Row"]>;
        Relationships: [];
      };
      quality_inspections: {
        Row: {
          id: string;
          inspection_no: string;
          work_order_id: string | null;
          inspection_type: string;
          product_code: string;
          product_name: string;
          batch_no: string | null;
          inspector_name: string;
          inspection_time: string;
          sample_size: number;
          pass_quantity: number;
          fail_quantity: number;
          result: string;
          defect_code: string | null;
          defect_description: string | null;
          measurements: unknown | null;
          notes: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["quality_inspections"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["quality_inspections"]["Row"]>;
        Relationships: [];
      };
      health_check: {
        Row: { id: number; updated_at: string | null };
        Insert: { id?: number; updated_at?: string | null };
        Update: Partial<Database["public"]["Tables"]["health_check"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
