import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

export interface ProcessDictionaryRow {
  id: string;
  process_code: string;
  process_name: string;
  sequence: number;
}

/** GET /api/process-dictionary — 工序字典列表（按 sequence 升序） */
export async function GET() {
  try {
    const c = getSupabaseClient();
    const { data, error } = await c
      .from("process_dictionary")
      .select("id, process_code, process_name, sequence")
      .order("sequence", { ascending: true });
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
