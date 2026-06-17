import { NextRequest, NextResponse } from 'next/server';
import { listInspections, listDefectCodes } from '@/lib/mes-service';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const [inspections, defectCodes] = await Promise.all([
      listInspections({
        from: sp.get('from') ?? undefined,
        to: sp.get('to') ?? undefined,
        lineCode: sp.get('line_code') ?? undefined,
        processName: sp.get('process') ?? undefined,
        result: sp.get('result') ?? undefined,
      }),
      listDefectCodes(),
    ]);
    return NextResponse.json({ success: true, data: { inspections, defectCodes } });
  } catch (e) {
    const message = e instanceof Error ? e.message : '获取检验记录失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
