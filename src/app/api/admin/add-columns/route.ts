import { NextResponse } from "next/server";

export async function POST() {
  try {
    const url = process.env.COZE_SUPABASE_URL;
    const serviceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.COZE_SUPABASE_ANON_KEY;
    
    if (!url || !serviceKey) {
      return NextResponse.json({ success: false, error: 'Missing Supabase credentials' });
    }
    
    // 使用 Supabase 的 SQL 执行 API
    const sqlStatements = [
      "ALTER TABLE operation_defects ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '[]'::jsonb",
      "ALTER TABLE operation_defects ADD COLUMN IF NOT EXISTS operation_name text DEFAULT ''",
      "ALTER TABLE process_infos ADD COLUMN IF NOT EXISTS material_type text DEFAULT ''"
    ];
    
    const results = [];
    
    for (const sql of sqlStatements) {
      try {
        const response = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sql }),
        });
        
        const text = await response.text();
        results.push({ sql, status: response.status, response: text });
      } catch (e) {
        results.push({ sql, error: e instanceof Error ? e.message : 'Unknown error' });
      }
    }
    
    // 尝试另一种方式：直接使用 Postgres 连接
    // 由于 exec_sql RPC 可能不存在，我们需要使用其他方法
    
    return NextResponse.json({ 
      success: true, 
      message: 'Attempted to add columns via RPC',
      results,
      hint: '如果 RPC 失败，需要手动在 Supabase Dashboard 执行 SQL'
    });
  } catch (e) {
    return NextResponse.json({ 
      success: false, 
      error: e instanceof Error ? e.message : 'Unknown error' 
    });
  }
}