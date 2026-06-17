import { NextRequest, NextResponse } from 'next/server';
import { listDailyReports } from '@/lib/mes-service';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const data = await listDailyReports({
      start_date: sp.get('from') ?? undefined,
      end_date: sp.get('to') ?? undefined,
      line_code: sp.get('line_code') ?? undefined,
      process_name: sp.get('process') ?? undefined,
    });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : '获取质量日报失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
