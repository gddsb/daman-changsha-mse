import { NextRequest, NextResponse } from 'next/server';
import { getDashboardSummary } from '@/lib/dashboard-service';

export async function GET(_request: NextRequest) {
  try {
    const summary = await getDashboardSummary();
    return NextResponse.json({ success: true, data: summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : '看板数据获取失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
