import { NextRequest, NextResponse } from 'next/server';
import { getDashboardSummary } from '@/lib/dashboard-service';

export async function GET(_request: NextRequest) {
  try {
    const data = await getDashboardSummary();
    return NextResponse.json({ success: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : '查询看板数据失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
