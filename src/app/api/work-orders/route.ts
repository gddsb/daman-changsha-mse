import { NextRequest, NextResponse } from 'next/server';
import { listWorkOrders } from '@/lib/mes-service';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const status = sp.get('status') ?? undefined;
    const line = sp.get('line_code') ?? undefined;
    const keyword = sp.get('search') ?? undefined;
    const limit = sp.get('limit') ? Number(sp.get('limit')) : undefined;
    const data = await listWorkOrders({ status, line, keyword, limit });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : '查询工单失败';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
